import { ipcMain } from 'electron';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// Store active automation jobs with timeout
interface AutomationJob {
  id: string;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: number;
  expiresAt: number;
  context?: BrowserContext;
}

const activeJobs: Record<string, AutomationJob> = {};
let browser: Browser | null = null;

// Configuration
const JOB_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 1 * 60 * 1000; // 1 minute
const MAX_CONCURRENT_JOBS = 5;
const USER_DATA_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.api-credential-manager', 'browser-data');

/**
 * Ensure browser is launched with secure settings
 */
async function ensureBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: process.env.NODE_ENV === 'production',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
  }
  return browser;
}

/**
 * Create a new browser context with secure settings
 */
async function createSecureContext(browser: Browser): Promise<BrowserContext> {
  return await browser.newContext({
    userAgent: 'API Credential Manager/1.0',
    viewport: { width: 1920, height: 1080 },
    userDataDir: USER_DATA_DIR,
    ignoreHTTPSErrors: false,
    bypassCSP: false,
    javaScriptEnabled: true,
    hasTouch: false,
    isMobile: false,
    acceptDownloads: false,
    permissions: ['geolocation']
  });
}

/**
 * Run the OpenAI key fetching automation
 */
async function fetchOpenAIKey(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  
  try {
    // Set up page security headers
    await page.setExtraHTTPHeaders({
      'User-Agent': 'API Credential Manager/1.0',
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Navigate to the OpenAI API keys page
    await page.goto('https://platform.openai.com/account/api-keys', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Wait for user to log in if needed (this will handle itself since headless:false)
    // We'll detect when we're on the API keys page by looking for the create button
    await page.waitForSelector('button:has-text("Create new secret key")', { 
      timeout: 60000,
      state: 'visible'
    });
    
    // Click the button to create a new key
    await page.click('button:has-text("Create new secret key")');
    
    // Get the key from the modal (assuming it appears in a modal)
    // This selector may need to be adjusted based on OpenAI's UI
    const keyElement = await page.waitForSelector('code, .api-key, [data-testid="key-value"]', { 
      timeout: 10000,
      state: 'visible'
    });
    
    if (!keyElement) {
      throw new Error('Could not find API key in the UI');
    }
    
    const apiKey = await keyElement.textContent();
    
    if (!apiKey) {
      throw new Error('API key was empty');
    }
    
    // Validate key format
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid API key format');
    }
    
    return apiKey;
  } catch (error) {
    console.error('Error in OpenAI automation:', error);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * Clean up expired jobs and contexts
 */
function cleanupExpiredJobs(): void {
  const now = Date.now();
  for (const [jobId, job] of Object.entries(activeJobs)) {
    if (now > job.expiresAt) {
      if (job.context) {
        job.context.close().catch(console.error);
      }
      delete activeJobs[jobId];
    }
  }
}

/**
 * Set up IPC handlers for automation
 */
export function setupAutomationIPC() {
  // Handle running automation tasks
  ipcMain.handle('run-automation', async (_, serviceName: string, actionName: string, params: any) => {
    try {
      // Check if we've reached the maximum number of concurrent jobs
      const runningJobs = Object.values(activeJobs).filter(job => job.status === 'running');
      if (runningJobs.length >= MAX_CONCURRENT_JOBS) {
        throw new Error('Maximum number of concurrent automation jobs reached. Please try again later.');
      }
      
      // Generate a unique job ID
      const jobId = crypto.randomBytes(8).toString('hex');
      
      // Create a job entry
      activeJobs[jobId] = {
        id: jobId,
        status: 'running',
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_TIMEOUT
      };
      
      // Run the automation in the background
      runAutomation(jobId, serviceName, actionName, params).catch(error => {
        console.error(`Automation error for ${serviceName}.${actionName}:`, error);
        activeJobs[jobId].status = 'failed';
        activeJobs[jobId].error = error.message || 'Unknown error';
      });
      
      // Return the job ID immediately
      return {
        success: true,
        jobId
      };
    } catch (error) {
      console.error('Failed to start automation:', error);
      return {
        success: false,
        error: (error as Error).message || 'Failed to start automation'
      };
    }
  });
  
  // Check automation status
  ipcMain.handle('check-automation-status', (_, jobId: string) => {
    const job = activeJobs[jobId];
    
    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      };
    }
    
    // Check if job has expired
    if (Date.now() > job.expiresAt) {
      if (job.context) {
        job.context.close().catch(console.error);
      }
      delete activeJobs[jobId];
      return {
        success: false,
        error: 'Job has expired'
      };
    }
    
    // If job is completed or failed, clean it up after returning the status
    const result = {
      success: job.status !== 'failed',
      status: job.status,
      result: job.result,
      error: job.error
    };
    
    if (job.status === 'completed' || job.status === 'failed') {
      // Keep jobs around for a while for status checks, but clean them up eventually
      setTimeout(() => {
        if (job.context) {
          job.context.close().catch(console.error);
        }
        delete activeJobs[jobId];
      }, 60000); // Keep completed job info for 1 minute
    }
    
    return result;
  });
  
  // Start cleanup interval
  setInterval(cleanupExpiredJobs, CLEANUP_INTERVAL);
  
  // Clean up browser when app is closing
  const cleanUp = async () => {
    // Close all contexts
    for (const job of Object.values(activeJobs)) {
      if (job.context) {
        await job.context.close().catch(console.error);
      }
    }
    
    // Clear all jobs
    Object.keys(activeJobs).forEach(jobId => {
      delete activeJobs[jobId];
    });
    
    // Close browser
    if (browser) {
      await browser.close();
      browser = null;
    }
  };
  
  process.on('exit', cleanUp);
  process.on('SIGINT', cleanUp);
  process.on('SIGTERM', cleanUp);
}

/**
 * Run the specific automation task
 */
async function runAutomation(
  jobId: string, 
  serviceName: string, 
  actionName: string, 
  params: any
) {
  try {
    let result;
    const browser = await ensureBrowser();
    const context = await createSecureContext(browser);
    
    // Store context in job for cleanup
    activeJobs[jobId].context = context;
    
    // Route to the appropriate automation function
    if (serviceName === 'openai' && actionName === 'fetchKey') {
      result = await fetchOpenAIKey(context);
    } else if (serviceName === 'google' && actionName === 'completeOAuth') {
      // This would be implemented similarly
      throw new Error('Google OAuth automation not implemented yet');
    } else {
      // Check if there's a plugin for this service/action
      const pluginFile = path.join(__dirname, '..', '..', 'plugins', `${serviceName}.js`);
      
      if (fs.existsSync(pluginFile)) {
        // Load and execute the plugin
        const plugin = require(pluginFile);
        if (typeof plugin[actionName] === 'function') {
          result = await plugin[actionName](params, { context });
        } else {
          throw new Error(`Action "${actionName}" not found in plugin for "${serviceName}"`);
        }
      } else {
        throw new Error(`No automation available for ${serviceName}.${actionName}`);
      }
    }
    
    // Update job status
    activeJobs[jobId].status = 'completed';
    activeJobs[jobId].result = result;
    
    return result;
  } catch (error) {
    activeJobs[jobId].status = 'failed';
    activeJobs[jobId].error = (error as Error).message || 'Unknown error';
    throw error;
  }
} 
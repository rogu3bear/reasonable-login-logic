import { ipcMain, BrowserWindow } from 'electron';
import * as express from 'express';
import * as http from 'http';
import * as crypto from 'crypto';
import * as querystring from 'querystring';
import * as url from 'url';
import * as rateLimit from 'express-rate-limit';
import * as helmet from 'helmet';

// Store active OAuth sessions with expiration
interface OAuthSession {
  sessionId: string;
  redirectUri: string;
  result?: {
    code?: string;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  };
  completed: boolean;
  createdAt: number;
  expiresAt: number;
  clientId: string;
  scopes: string[];
}

const activeSessions: Record<string, OAuthSession> = {};
let server: http.Server | null = null;
let port = 0;

// Session configuration
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SESSIONS = 100;

// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

/**
 * Start the local OAuth callback server
 */
function startServer() {
  if (server) return port;

  const app = express();
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        sandbox: ['allow-scripts', 'allow-same-origin']
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  
  // Rate limiting
  app.use(rateLimiter);
  
  // Handle OAuth callback
  app.get('/oauth/callback', async (req, res) => {
    try {
      const { state, code, error } = req.query;
      const sessionId = state as string;
      
      if (!sessionId || !activeSessions[sessionId]) {
        return res.status(400).send('Invalid OAuth callback. Please close this window and try again.');
      }
      
      const session = activeSessions[sessionId];
      
      // Check if session has expired
      if (Date.now() > session.expiresAt) {
        delete activeSessions[sessionId];
        return res.status(400).send('OAuth session has expired. Please try again.');
      }
      
      if (error) {
        session.result = {
          error: error as string
        };
      } else if (code) {
        session.result = {
          code: code as string
        };
      }
      
      session.completed = true;
      
      // Send a success page that auto-closes
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authorization Complete</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center; 
                padding: 2rem;
                background-color: #f8f9fa;
              }
              .success { 
                color: #0f5132; 
                background-color: #d1e7dd; 
                padding: 1rem; 
                border-radius: 0.25rem;
                max-width: 600px;
                margin: 0 auto;
              }
              .error {
                color: #842029;
                background-color: #f8d7da;
                padding: 1rem;
                border-radius: 0.25rem;
                max-width: 600px;
                margin: 0 auto;
              }
            </style>
          </head>
          <body>
            <div class="${error ? 'error' : 'success'}">
              <h1>Authorization ${error ? 'Failed' : 'Complete'}</h1>
              <p>${error ? 'There was an error during authorization.' : 'You have successfully authorized the application.'}</p>
              <p>You can close this window.</p>
            </div>
            <script>
              // Close the window after a short delay
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      res.status(500).send('An error occurred during authorization. Please try again.');
    }
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });
  
  // Start listening on a random port
  server = app.listen(0, () => {
    const address = server?.address() as { port: number };
    port = address.port;
    console.log(`OAuth callback server listening on port ${port}`);
  });
  
  // Start session cleanup interval
  setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL);
  
  return port;
}

/**
 * Generate a PKCE code challenge and verifier
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallengeBuffer = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = codeChallengeBuffer.toString('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of Object.entries(activeSessions)) {
    if (now > session.expiresAt) {
      delete activeSessions[sessionId];
    }
  }
}

/**
 * Set up IPC handlers for OAuth flows
 */
export function setupOAuthServer() {
  // Start OAuth flow
  ipcMain.handle('start-oauth-flow', async (_, config: {
    authUrl: string;
    clientId: string;
    scopes: string[];
    usePKCE?: boolean;
  }) => {
    try {
      // Check if we've reached the maximum number of sessions
      if (Object.keys(activeSessions).length >= MAX_SESSIONS) {
        cleanupExpiredSessions();
        if (Object.keys(activeSessions).length >= MAX_SESSIONS) {
          throw new Error('Maximum number of active OAuth sessions reached. Please try again later.');
        }
      }
      
      // Make sure server is running
      startServer();
      
      const sessionId = crypto.randomBytes(16).toString('hex');
      
      // Create redirect URI to our local server
      const redirectUri = `http://localhost:${port}/oauth/callback`;
      
      // Generate PKCE if needed
      const pkce = config.usePKCE ? generatePKCE() : undefined;
      
      // Store session with expiration
      activeSessions[sessionId] = {
        sessionId,
        redirectUri,
        completed: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TIMEOUT,
        clientId: config.clientId,
        scopes: config.scopes
      };
      
      // Build authorization URL
      const authUrlObj = new URL(config.authUrl);
      const params: Record<string, string> = {
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state: sessionId
      };
      
      // Add PKCE parameters if using PKCE
      if (pkce) {
        params.code_challenge = pkce.codeChallenge;
        params.code_challenge_method = 'S256';
      }
      
      // Add parameters to URL
      Object.entries(params).forEach(([key, value]) => {
        authUrlObj.searchParams.append(key, value);
      });
      
      const authUrlString = authUrlObj.toString();
      
      // Open a new browser window
      const authWindow = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });
      
      // Navigate to the auth URL
      await authWindow.loadURL(authUrlString);
      
      // Return session info to the renderer
      return {
        success: true,
        sessionId,
        codeVerifier: pkce?.codeVerifier
      };
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
      return { 
        success: false, 
        error: (error as Error).message || 'Failed to start OAuth flow' 
      };
    }
  });

  // Check OAuth result
  ipcMain.handle('check-oauth-result', (_, sessionId: string) => {
    const session = activeSessions[sessionId];
    
    if (!session) {
      return {
        success: false,
        error: 'Session not found'
      };
    }
    
    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      delete activeSessions[sessionId];
      return {
        success: false,
        error: 'Session has expired'
      };
    }
    
    if (!session.completed) {
      return {
        success: true,
        completed: false
      };
    }
    
    // Session completed - return result and clean up
    const result = session.result;
    delete activeSessions[sessionId];
    
    if (result?.error) {
      return {
        success: false,
        error: result.error
      };
    }
    
    return {
      success: true,
      completed: true,
      code: result?.code
    };
  });

  // Clean up function (called when app is closing)
  const cleanUp = () => {
    if (server) {
      server.close();
      server = null;
    }
    // Clear all active sessions
    Object.keys(activeSessions).forEach(sessionId => {
      delete activeSessions[sessionId];
    });
  };

  // Handle app quit
  process.on('exit', cleanUp);
  process.on('SIGINT', cleanUp);
  process.on('SIGTERM', cleanUp);
} 
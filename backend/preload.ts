import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the exposed API
interface Credential {
  id: string;
  serviceId: string;
  name: string;
  value: string;
  type: 'apiKey' | 'oauth';
  expiresAt?: number;
  refreshToken?: string;
  lastVerified?: number;
  metadata?: Record<string, any>;
}

interface OAuthConfig {
  authUrl: string;
  clientId: string;
  scopes: string[];
  usePKCE?: boolean;
}

interface AutomationParams {
  [key: string]: any;
}

interface FileOptions {
  content: string;
  defaultPath: string;
  filters: Array<{
    name: string;
    extensions: string[];
  }>;
}

interface FileResult {
  success: boolean;
  filePath?: string;
  content?: string;
  error?: string;
  canceled?: boolean;
}

// Validate input data
function validateCredential(credential: any): credential is Credential {
  return (
    typeof credential === 'object' &&
    typeof credential.id === 'string' &&
    typeof credential.serviceId === 'string' &&
    typeof credential.name === 'string' &&
    typeof credential.value === 'string' &&
    (credential.type === 'apiKey' || credential.type === 'oauth')
  );
}

function validateOAuthConfig(config: any): config is OAuthConfig {
  return (
    typeof config === 'object' &&
    typeof config.authUrl === 'string' &&
    typeof config.clientId === 'string' &&
    Array.isArray(config.scopes) &&
    config.scopes.every((scope: any) => typeof scope === 'string')
  );
}

function validateAutomationParams(params: any): params is AutomationParams {
  return typeof params === 'object';
}

function validateFileOptions(options: any): options is FileOptions {
  return (
    typeof options === 'object' &&
    typeof options.content === 'string' &&
    typeof options.defaultPath === 'string' &&
    Array.isArray(options.filters)
  );
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Credential management
  credentials: {
    saveCredential: async (credential: unknown) => {
      if (!validateCredential(credential)) {
        throw new Error('Invalid credential data');
      }
      return await ipcRenderer.invoke('save-credential', credential);
    },
    
    getCredential: async (id: string) => {
      if (typeof id !== 'string') {
        throw new Error('Invalid credential ID');
      }
      return await ipcRenderer.invoke('get-credential', id);
    },
    
    getAllCredentials: async () => {
      return await ipcRenderer.invoke('get-all-credentials');
    },
    
    deleteCredential: async (id: string) => {
      if (typeof id !== 'string') {
        throw new Error('Invalid credential ID');
      }
      return await ipcRenderer.invoke('delete-credential', id);
    },
    
    exportVault: async (exportPassword: string) => {
      if (typeof exportPassword !== 'string') {
        throw new Error('Invalid export password');
      }
      return await ipcRenderer.invoke('export-vault', exportPassword);
    },
    
    importVault: async (importData: string, importPassword: string) => {
      if (typeof importData !== 'string' || typeof importPassword !== 'string') {
        throw new Error('Invalid import data or password');
      }
      return await ipcRenderer.invoke('import-vault', importData, importPassword);
    }
  },
  
  // OAuth handling
  oauth: {
    startOAuthFlow: async (config: unknown) => {
      if (!validateOAuthConfig(config)) {
        throw new Error('Invalid OAuth configuration');
      }
      return await ipcRenderer.invoke('start-oauth-flow', config);
    },
    
    checkOAuthResult: async (sessionId: string) => {
      if (typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      return await ipcRenderer.invoke('check-oauth-result', sessionId);
    }
  },
  
  // Browser automation
  automation: {
    runAutomation: async (
      serviceName: string,
      actionName: string,
      params: unknown
    ) => {
      if (
        typeof serviceName !== 'string' ||
        typeof actionName !== 'string' ||
        !validateAutomationParams(params)
      ) {
        throw new Error('Invalid automation parameters');
      }
      return await ipcRenderer.invoke('run-automation', serviceName, actionName, params);
    },
    
    checkAutomationStatus: async (jobId: string) => {
      if (typeof jobId !== 'string') {
        throw new Error('Invalid job ID');
      }
      return await ipcRenderer.invoke('check-automation-status', jobId);
    }
  },
  
  // File system operations
  files: {
    saveFile: async (options: unknown): Promise<FileResult> => {
      if (!validateFileOptions(options)) {
        throw new Error('Invalid file options');
      }
      return await ipcRenderer.invoke('save-file', options);
    },
    
    openFile: async (options: { filters: Array<{ name: string; extensions: string[] }> }) => {
      if (!Array.isArray(options.filters)) {
        throw new Error('Invalid file filters');
      }
      return await ipcRenderer.invoke('open-file', options);
    }
  },
  
  // Open external URLs
  openExternalUrl: async (url: string) => {
    if (typeof url !== 'string') {
      throw new Error('Invalid URL');
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }
    
    // Only allow specific protocols
    if (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('mailto:')) {
      throw new Error('Unsupported URL protocol');
    }
    
    return await ipcRenderer.invoke('open-external-url', url);
  }
}); 
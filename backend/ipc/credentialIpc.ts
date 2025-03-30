import { ipcMain } from 'electron';
import * as keytar from 'keytar';
import Store from 'electron-store';
import { app } from 'electron';

// Service name for keytar - use app name and version for uniqueness
const SERVICE_NAME = `${app.getName()}-${app.getVersion()}`;

// Store for metadata (doesn't store the actual sensitive values)
const store = new Store({
  name: 'credential-metadata',
  encryptionKey: process.env.NODE_ENV === 'production' 
    ? process.env.STORE_ENCRYPTION_KEY 
    : 'dev-encryption-key', // Only used in development
});

// Define the structure of our credential metadata
interface CredentialMetadata {
  id: string;
  serviceId: string;
  name: string;
  type: 'apiKey' | 'oauth';
  expiresAt?: number;
  lastVerified?: number;
  metadata?: Record<string, any>;
}

// Error handling wrapper for keytar operations
async function secureKeytarOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Keytar operation failed: ${errorMessage}`, error);
    throw new Error(`Failed to perform secure operation: ${errorMessage}`);
  }
}

// Initialize the metadata store if it doesn't exist
if (!store.has('credentials')) {
  store.set('credentials', {});
}

/**
 * Set up IPC handlers for credential management
 */
export function setupCredentialIPC() {
  // Save a credential
  ipcMain.handle('save-credential', async (_, credential: any) => {
    try {
      const { id, value, refreshToken, ...metadata } = credential;
      
      // Store the actual credential value in the OS keychain
      await keytar.setPassword(SERVICE_NAME, id, value);
      
      // If there's a refresh token (for OAuth), store that separately
      if (refreshToken) {
        await keytar.setPassword(`${SERVICE_NAME}-refresh`, id, refreshToken);
      }
      
      // Store metadata (without the actual credential value) in the store
      const credentials = store.get('credentials') as Record<string, CredentialMetadata>;
      credentials[id] = { id, ...metadata };
      store.set('credentials', credentials);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to save credential:', error);
      return { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred' 
      };
    }
  });

  // Get a credential by ID
  ipcMain.handle('get-credential', async (_, id: string) => {
    try {
      const credentials = store.get('credentials') as Record<string, CredentialMetadata>;
      const metadata = credentials[id];
      
      if (!metadata) {
        return { success: false, error: 'Credential not found' };
      }
      
      // Get the actual value from keychain
      const value = await keytar.getPassword(SERVICE_NAME, id);
      
      if (!value) {
        return { success: false, error: 'Credential value not found in secure storage' };
      }
      
      // Also get refresh token if this is an OAuth credential
      let refreshToken;
      if (metadata.type === 'oauth') {
        refreshToken = await keytar.getPassword(`${SERVICE_NAME}-refresh`, id);
      }
      
      return { 
        success: true, 
        credential: { 
          ...metadata, 
          value,
          refreshToken 
        } 
      };
    } catch (error) {
      console.error('Failed to get credential:', error);
      return { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred' 
      };
    }
  });

  // Get all credentials (without sensitive values)
  ipcMain.handle('get-all-credentials', async () => {
    try {
      const credentials = store.get('credentials') as Record<string, CredentialMetadata>;
      return { 
        success: true, 
        credentials: Object.values(credentials)
      };
    } catch (error) {
      console.error('Failed to get all credentials:', error);
      return { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred' 
      };
    }
  });

  // Delete a credential
  ipcMain.handle('delete-credential', async (_, id: string) => {
    try {
      // Delete from keychain
      await keytar.deletePassword(SERVICE_NAME, id);
      
      // Also delete refresh token if it exists
      try {
        await keytar.deletePassword(`${SERVICE_NAME}-refresh`, id);
      } catch (e) {
        // Ignore errors if refresh token doesn't exist
      }
      
      // Delete from metadata store
      const credentials = store.get('credentials') as Record<string, CredentialMetadata>;
      if (credentials[id]) {
        delete credentials[id];
        store.set('credentials', credentials);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete credential:', error);
      return { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred' 
      };
    }
  });

  // Export vault
  ipcMain.handle('export-vault', async (_, exportPassword: string) => {
    try {
      const credentials = store.get('credentials') as Record<string, CredentialMetadata>;
      const exportData: any[] = [];
      
      // For each credential, get the value and create an export object
      for (const id in credentials) {
        const metadata = credentials[id];
        const value = await keytar.getPassword(SERVICE_NAME, id);
        let refreshToken;
        
        if (metadata.type === 'oauth') {
          refreshToken = await keytar.getPassword(`${SERVICE_NAME}-refresh`, id);
        }
        
        if (value) {
          exportData.push({
            ...metadata,
            value,
            refreshToken
          });
        }
      }
      
      // In a real app, we'd encrypt this with the provided password
      // For simplicity, just returning a JSON string
      return { 
        success: true, 
        exportData: JSON.stringify({
          version: '1.0',
          timestamp: Date.now(),
          credentials: exportData
        })
      };
    } catch (error) {
      console.error('Failed to export vault:', error);
      return { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred' 
      };
    }
  });

  // Import vault
  ipcMain.handle('import-vault', async (_, importData: string, importPassword: string) => {
    try {
      // In a real app, we'd decrypt the import data with the provided password
      const importedVault = JSON.parse(importData);
      
      if (!importedVault.credentials || !Array.isArray(importedVault.credentials)) {
        return { success: false, error: 'Invalid import data format' };
      }
      
      // Import each credential
      for (const credential of importedVault.credentials) {
        const { id, value, refreshToken, ...metadata } = credential;
        
        // Store in keychain
        await keytar.setPassword(SERVICE_NAME, id, value);
        
        if (refreshToken) {
          await keytar.setPassword(`${SERVICE_NAME}-refresh`, id, refreshToken);
        }
        
        // Update metadata store
        const credentials = store.get('credentials') as Record<string, CredentialMetadata>;
        credentials[id] = { id, ...metadata };
        store.set('credentials', credentials);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to import vault:', error);
      return { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred' 
      };
    }
  });
} 
import { Credential } from '../types/ServiceDefinition';
import * as encryption from './encryption';

const VAULT_STORAGE_KEY = 'credential_vault';
const IS_ELECTRON = window && (window as any).electron !== undefined;

interface VaultData {
  version: string;
  credentials: Record<string, string>; // Encrypted credentials
  lastUpdated: number;
  salt?: string; // For password-based encryption
}

/**
 * Class to handle secure storage of credentials
 * Uses OS keychain in Electron, falls back to encrypted localStorage in browser
 */
export class CredentialVault {
  private encryptionKey: CryptoKey | null = null;
  private initialized = false;
  private vaultData: VaultData | null = null;

  /**
   * Initialize the vault, generating or retrieving the encryption key
   */
  async initialize(password?: string): Promise<boolean> {
    try {
      if (IS_ELECTRON) {
        // In Electron, use the backend's secure storage
        return await this.initializeElectron();
      }

      if (password) {
        // If a password is provided, derive the key from it
        const salt = await this.getSalt();
        const { key, salt: newSalt } = await encryption.deriveKeyFromPassword(password, salt);
        this.encryptionKey = key;
        
        // Store the salt if it's new
        if (newSalt) {
          await this.storeSalt(newSalt);
        }
      } else {
        // Try to get the stored key or generate a new one
        let key = await encryption.getStoredEncryptionKey();
        
        if (!key) {
          key = await encryption.generateEncryptionKey();
          await encryption.storeEncryptionKey(key);
        }
        
        this.encryptionKey = key;
      }
      
      // Load or initialize vault data
      await this.loadVaultData();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize vault:', error);
      this.handleError(error);
      return false;
    }
  }

  /**
   * Initialize vault in Electron environment
   */
  private async initializeElectron(): Promise<boolean> {
    try {
      // In Electron, we rely on the backend for secure storage
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Electron vault:', error);
      this.handleError(error);
      return false;
    }
  }

  /**
   * Get or create a salt for password-based encryption
   */
  private async getSalt(): Promise<Uint8Array | undefined> {
    try {
      const db = await this.openIndexedDB();
      const tx = db.transaction('vault', 'readonly');
      const store = tx.objectStore('vault');
      const storedSalt = await store.get('salt');
      await tx.done;
      
      if (storedSalt) {
        return this.hexToUint8Array(storedSalt);
      }
      return undefined;
    } catch (error) {
      console.error('Failed to get salt:', error);
      return undefined;
    }
  }

  /**
   * Store salt for password-based encryption
   */
  private async storeSalt(salt: Uint8Array): Promise<void> {
    try {
      const hexSalt = Array.from(salt)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const db = await this.openIndexedDB();
      const tx = db.transaction('vault', 'readwrite');
      const store = tx.objectStore('vault');
      await store.put(hexSalt, 'salt');
      await tx.done;
    } catch (error) {
      console.error('Failed to store salt:', error);
      throw error;
    }
  }

  /**
   * Opens IndexedDB database
   */
  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('credential_vault', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('vault')) {
          db.createObjectStore('vault');
        }
      };
    });
  }

  /**
   * Convert hex string to Uint8Array
   */
  private hexToUint8Array(hex: string): Uint8Array {
    const array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      array[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return array;
  }

  /**
   * Load vault data from storage
   */
  private async loadVaultData(): Promise<void> {
    try {
      const storedData = localStorage.getItem(VAULT_STORAGE_KEY);
      
      if (storedData) {
        this.vaultData = JSON.parse(storedData);
      } else {
        this.vaultData = {
          version: '1.0',
          credentials: {},
          lastUpdated: Date.now()
        };
      }
    } catch (error) {
      console.error('Failed to load vault data:', error);
      this.handleError(error);
      this.vaultData = {
        version: '1.0',
        credentials: {},
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * Save vault data to storage
   */
  private async saveVaultData(): Promise<void> {
    if (!this.vaultData) return;
    
    try {
      this.vaultData.lastUpdated = Date.now();
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(this.vaultData));
    } catch (error) {
      console.error('Failed to save vault data:', error);
      this.handleError(error);
    }
  }

  /**
   * Save a credential to the vault
   */
  async saveCredential(credential: Credential): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Vault is not initialized');
    }

    try {
      if (IS_ELECTRON) {
        // Use Electron's secure storage
        const result = await (window as any).electron.credentials.saveCredential(credential);
        return result.success;
      }

      if (!this.encryptionKey || !this.vaultData) {
        throw new Error('Vault is not properly initialized');
      }

      // Encrypt the credential
      const encryptedValue = await encryption.encryptValue(
        JSON.stringify(credential),
        this.encryptionKey
      );
      
      // Store it
      this.vaultData.credentials[credential.id] = encryptedValue;
      
      // Save back to storage
      await this.saveVaultData();
      
      return true;
    } catch (error) {
      console.error('Failed to save credential:', error);
      this.handleError(error);
      return false;
    }
  }

  /**
   * Get a credential from the vault
   */
  async getCredential(id: string): Promise<Credential | null> {
    if (!this.initialized) {
      throw new Error('Vault is not initialized');
    }

    try {
      if (IS_ELECTRON) {
        // Use Electron's secure storage
        const result = await (window as any).electron.credentials.getCredential(id);
        return result.success ? result.credential : null;
      }

      if (!this.encryptionKey || !this.vaultData) {
        throw new Error('Vault is not properly initialized');
      }

      const encryptedValue = this.vaultData.credentials[id];
      
      if (!encryptedValue) {
        return null;
      }
      
      const decryptedValue = await encryption.decryptValue(
        encryptedValue,
        this.encryptionKey
      );
      
      return JSON.parse(decryptedValue) as Credential;
    } catch (error) {
      console.error('Failed to get credential:', error);
      this.handleError(error);
      return null;
    }
  }

  /**
   * Get all credentials
   */
  async getAllCredentials(): Promise<Credential[]> {
    if (!this.initialized) {
      throw new Error('Vault is not initialized');
    }

    try {
      if (IS_ELECTRON) {
        // Use Electron's secure storage
        const result = await (window as any).electron.credentials.getAllCredentials();
        return result.success ? result.credentials : [];
      }

      if (!this.encryptionKey || !this.vaultData) {
        throw new Error('Vault is not properly initialized');
      }

      const credentials: Credential[] = [];
      
      for (const id in this.vaultData.credentials) {
        const credential = await this.getCredential(id);
        if (credential) {
          credentials.push(credential);
        }
      }
      
      return credentials;
    } catch (error) {
      console.error('Failed to get all credentials:', error);
      this.handleError(error);
      return [];
    }
  }

  /**
   * Delete a credential from the vault
   */
  async deleteCredential(id: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Vault is not initialized');
    }

    try {
      if (IS_ELECTRON) {
        // Use Electron's secure storage
        const result = await (window as any).electron.credentials.deleteCredential(id);
        return result.success;
      }

      if (!this.vaultData) {
        throw new Error('Vault is not properly initialized');
      }

      if (this.vaultData.credentials[id]) {
        delete this.vaultData.credentials[id];
        await this.saveVaultData();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete credential:', error);
      this.handleError(error);
      return false;
    }
  }

  /**
   * Export the vault as encrypted JSON
   */
  async exportVault(exportPassword: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Vault is not initialized');
    }

    try {
      if (IS_ELECTRON) {
        // Use Electron's secure storage
        const result = await (window as any).electron.credentials.exportVault(exportPassword);
        return result.success ? result.exportData : '';
      }

      const credentials = await this.getAllCredentials();
      const exportData = {
        version: '1.0',
        timestamp: Date.now(),
        credentials
      };
      
      // Derive a new key from the export password
      const { key, salt } = await encryption.deriveKeyFromPassword(exportPassword);
      
      // Encrypt the entire vault
      const encryptedVault = await encryption.encryptValue(
        JSON.stringify(exportData),
        key
      );
      
      // Return the salt and encrypted data
      return JSON.stringify({
        salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
        encryptedData: encryptedVault
      });
    } catch (error) {
      console.error('Failed to export vault:', error);
      this.handleError(error);
      throw new Error('Export failed');
    }
  }

  /**
   * Import a vault from encrypted JSON
   */
  async importVault(importData: string, importPassword: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Vault is not initialized');
    }

    try {
      if (IS_ELECTRON) {
        // Use Electron's secure storage
        const result = await (window as any).electron.credentials.importVault(importData, importPassword);
        return result.success;
      }

      const { salt: saltHex, encryptedData } = JSON.parse(importData);
      
      // Recreate the salt from hex
      const salt = this.hexToUint8Array(saltHex);
      
      // Derive the key from the password and salt
      const { key } = await encryption.deriveKeyFromPassword(importPassword, salt);
      
      // Decrypt the vault
      const decryptedData = await encryption.decryptValue(encryptedData, key);
      const importedVault = JSON.parse(decryptedData);
      
      // Store each credential
      for (const credential of importedVault.credentials) {
        await this.saveCredential(credential);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import vault:', error);
      this.handleError(error);
      return false;
    }
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: unknown): void {
    // Log error details
    console.error('Vault error:', error);
    
    // In a production app, you might want to:
    // 1. Report to error tracking service
    // 2. Show user-friendly error message
    // 3. Attempt recovery if possible
  }

  /**
   * Check if vault is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Create and export a singleton instance
export const credentialVault = new CredentialVault(); 
/**
 * Utility for encrypting and decrypting credentials using Web Crypto API
 * Implements AES-GCM encryption with PBKDF2 key derivation
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const STORAGE_KEY = 'vault_encryption_key';
const SALT_LENGTH = 32; // Increased from 16 for better security
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000; // Increased from 100000 for better security
const PBKDF2_HASH = 'SHA-256';

/**
 * Derives an encryption key from a master password using PBKDF2
 * Returns both the key and salt for storage
 */
export async function deriveKeyFromPassword(
  password: string, 
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  try {
    // Generate a random salt if not provided
    const saltBuffer = salt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    
    // Convert password to a key using PBKDF2
    const passwordBuffer = new TextEncoder().encode(password);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    // Derive the actual encryption key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false, // non-extractable for security
      ['encrypt', 'decrypt']
    );
    
    return { key, salt: saltBuffer };
  } catch (error) {
    console.error('Failed to derive key:', error);
    throw new Error('Key derivation failed');
  }
}

/**
 * Generates a random encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  try {
    return await crypto.subtle.generateKey(
      { name: ALGORITHM, length: KEY_LENGTH },
      false, // non-extractable for security
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Failed to generate key:', error);
    throw new Error('Key generation failed');
  }
}

/**
 * Stores the encryption key in IndexedDB for use later
 */
export async function storeEncryptionKey(key: CryptoKey): Promise<void> {
  try {
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    const db = await openIndexedDB();
    const tx = db.transaction('keys', 'readwrite');
    const store = tx.objectStore('keys');
    await store.put(arrayBufferToBase64(exportedKey), STORAGE_KEY);
    await tx.done;
  } catch (error) {
    console.error('Failed to store key:', error);
    throw new Error('Key storage failed');
  }
}

/**
 * Retrieves the stored encryption key
 */
export async function getStoredEncryptionKey(): Promise<CryptoKey | null> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction('keys', 'readonly');
    const store = tx.objectStore('keys');
    const keyData = await store.get(STORAGE_KEY);
    await tx.done;
    
    if (!keyData) return null;
    
    const keyBuffer = base64ToArrayBuffer(keyData);
    return await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Failed to retrieve key:', error);
    return null;
  }
}

/**
 * Opens IndexedDB database
 */
async function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('credential_vault', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
    };
  });
}

/**
 * Encrypts a string value using AES-GCM
 * Returns a base64 string containing the IV and encrypted data
 */
export async function encryptValue(value: string, key: CryptoKey): Promise<string> {
  try {
    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const data = new TextEncoder().encode(value);
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );
    
    // Combine IV and encrypted data for storage
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    return arrayBufferToBase64(combined);
  } catch (error) {
    console.error('Failed to encrypt value:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts an encrypted string value using AES-GCM
 * Expects a base64 string containing the IV and encrypted data
 */
export async function decryptValue(encryptedValue: string, key: CryptoKey): Promise<string> {
  try {
    const data = base64ToArrayBuffer(encryptedValue);
    
    // Extract IV from the beginning of the data
    const iv = data.slice(0, IV_LENGTH);
    const encryptedData = data.slice(IV_LENGTH);
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Failed to decrypt value:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Converts an ArrayBuffer to a base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Failed to convert ArrayBuffer to base64:', error);
    throw new Error('Base64 conversion failed');
  }
}

/**
 * Converts a base64 string to an ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error('Failed to convert base64 to ArrayBuffer:', error);
    throw new Error('Base64 conversion failed');
  }
}

/**
 * Validates that the Web Crypto API is available
 */
export function validateCryptoSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.crypto !== undefined &&
    window.crypto.subtle !== undefined
  );
}

/**
 * Generates a cryptographically secure random string
 */
export function generateRandomString(length: number): string {
  try {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to generate random string:', error);
    throw new Error('Random string generation failed');
  }
} 
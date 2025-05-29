export async function openCredentialDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('credential_vault', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('vault')) {
        db.createObjectStore('vault');
      }
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
    };
  });
}


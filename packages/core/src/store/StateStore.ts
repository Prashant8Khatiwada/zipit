/**
 * IndexedDB-backed state store for ZipIt.
 * Persists download manifests so sessions survive page reloads.
 *
 * @internal — not part of the public API surface.
 */

import type { FileEntry } from '../types';

const STORE_NAME = 'manifest';
const DB_VERSION = 1;

export class StateStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor(dbName: string = 'dropstream_v1') {
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(
          new Error(
            '[ZipIt] IndexedDB is not available in this environment. ' +
              'ZipIt requires a browser environment. If you are seeing this in tests, mock indexedDB.'
          )
        );
        return;
      }

      const request = indexedDB.open(dbName, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) =>
        resolve((event.target as IDBOpenDBRequest).result);
      request.onerror = (event) =>
        reject((event.target as IDBOpenDBRequest).error);
    });
  }

  async getAll(): Promise<FileEntry[]> {
    const db = await this.dbPromise;
    return new Promise<FileEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as FileEntry[]);
      req.onerror = () => reject(req.error);
    });
  }

  async get(id: string): Promise<FileEntry | undefined> {
    const db = await this.dbPromise;
    return new Promise<FileEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result as FileEntry | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async upsert(entry: FileEntry): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

/**
 * IndexedDB Store — low-level wrapper around IndexedDB for the VFS.
 *
 * Database: awokeos-vfs
 * Object stores:
 *   - entries: { id, parentId, path, name, type, mimeType, size, content, createdAt, modifiedAt }
 *               indexes: parentId, path, type, name
 */

const DB_NAME = 'awokeos-vfs';
const DB_VERSION = 1;
const STORE_ENTRIES = 'entries';

let _dbPromise = null;

export function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
                const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
                store.createIndex('parentId', 'parentId', { unique: false });
                store.createIndex('path', 'path', { unique: true });
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('name', 'name', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('DB blocked'));
    });
    return _dbPromise;
}

function tx(mode = 'readonly') {
    return openDB().then(db => db.transaction(STORE_ENTRIES, mode).objectStore(STORE_ENTRIES));
}

function promisify(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function put(entry) {
    const store = await tx('readwrite');
    return promisify(store.put(entry));
}

export async function get(id) {
    const store = await tx('readonly');
    return promisify(store.get(id));
}

export async function getByPath(path) {
    const store = await tx('readonly');
    const idx = store.index('path');
    return promisify(idx.get(path));
}

export async function getByParent(parentId) {
    const store = await tx('readonly');
    const idx = store.index('parentId');
    return promisify(idx.getAll(parentId));
}

export async function deleteEntry(id) {
    const store = await tx('readwrite');
    return promisify(store.delete(id));
}

export async function deleteMany(ids) {
    const store = await tx('readwrite');
    const txr = store.transaction;
    const promises = ids.map(id => promisify(store.delete(id)));
    await Promise.all(promises);
}

export async function getAll() {
    const store = await tx('readonly');
    return promisify(store.getAll());
}

export async function count() {
    const store = await tx('readonly');
    return promisify(store.count());
}

export async function clear() {
    const store = await tx('readwrite');
    return promisify(store.clear());
}

/**
 * Storage usage estimate.
 */
export async function estimate() {
    if (navigator.storage?.estimate) {
        return navigator.storage.estimate();
    }
    return { usage: 0, quota: 0 };
}

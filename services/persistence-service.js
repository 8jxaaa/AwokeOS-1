/**
 * Persistence service — small wrapper over localStorage and IndexedDB.
 * Use `settings.*` for keyed key-value settings, and the VFS for files.
 */

const PREFIX = 'awokeos:';

export const settings = {
    get(key, defaultValue = null) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (raw === null) return defaultValue;
            return JSON.parse(raw);
        } catch {
            return defaultValue;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
            return true;
        } catch (err) {
            console.warn('[settings] set failed:', err);
            return false;
        }
    },
    remove(key) {
        localStorage.removeItem(PREFIX + key);
    },
    has(key) {
        return localStorage.getItem(PREFIX + key) !== null;
    },
    /** Get all keys with this prefix. */
    keys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
        }
        return keys;
    }
};

/**
 * Session storage helper — for ephemeral things like clipboard.
 */
export const session = {
    get(key, defaultValue = null) {
        try {
            const raw = sessionStorage.getItem(PREFIX + key);
            if (raw === null) return defaultValue;
            return JSON.parse(raw);
        } catch { return defaultValue; }
    },
    set(key, value) {
        try {
            sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
            return true;
        } catch { return false; }
    },
    remove(key) { sessionStorage.removeItem(PREFIX + key); }
};

/**
 * Per-app data storage: `appdata:appId`
 */
export const appData = {
    get(appId, key, defaultValue = null) {
        return settings.get(`appdata:${appId}:${key}`, defaultValue);
    },
    set(appId, key, value) {
        return settings.set(`appdata:${appId}:${key}`, value);
    },
    remove(appId, key) {
        settings.remove(`appdata:${appId}:${key}`);
    },
    getAll(appId) {
        const result = {};
        const prefix = `appdata:${appId}:`;
        for (const k of settings.keys()) {
            if (k.startsWith(prefix)) {
                result[k.slice(prefix.length)] = settings.get(k);
            }
        }
        return result;
    }
};

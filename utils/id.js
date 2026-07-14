/**
 * Unique ID generator.
 * Uses crypto.randomUUID when available; falls back to time+random for legacy browsers.
 */
export function uid(prefix = '') {
    let id;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = crypto.randomUUID();
    } else {
        id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
    return prefix ? `${prefix}_${id}` : id;
}

/**
 * Short ID for windows / icons.
 */
export function shortId() {
    return Math.random().toString(36).slice(2, 8);
}

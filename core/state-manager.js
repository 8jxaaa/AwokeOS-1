/**
 * State Manager — centralized reactive state with persistence.
 * Subscribers are notified on change.
 *
 * Usage:
 *   const state = getState();
 *   state.set('theme', 'dark');
 *   state.get('theme');
 *   state.subscribe('theme', (newVal, oldVal) => {});
 */

const STORAGE_KEY = 'awokeos:state';

const DEFAULT_STATE = {
    // Appearance
    theme: 'dark',
    accent: 'indigo',
    fontSize: 'medium',
    wallpaper: 'aurora',
    customWallpaper: null,

    // System
    language: 'en',
    reduceMotion: false,
    performance: 'auto', // low | auto | high
    animationSpeed: 'normal', // slow | normal | fast | instant

    // Taskbar
    taskbarPosition: 'bottom', // bottom | top | left | right
    taskbarAutoHide: false,

    // Visual effects
    transparency: 0.78,
    blurStrength: 24,

    // Sound
    soundEnabled: true,

    // Notifications
    notificationsEnabled: true,
    doNotDisturb: false,

    // Startup
    startupApps: [],

    // Privacy
    analytics: false,

    // Lock screen
    locked: false,

    // Window state
    windowStates: {}, // appId -> { x, y, w, h, maximized }

    // Desktop
    desktopIconOrder: [],

    // User
    username: 'User',

    // First boot
    firstBoot: true
};

class StateManager {
    constructor() {
        this._state = this._load();
        this._subscribers = new Map(); // key -> Set of callbacks
        this._globalSubs = new Set();
    }

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...DEFAULT_STATE, ...parsed };
            }
        } catch (err) {
            console.warn('[state] failed to load, using defaults:', err);
        }
        return { ...DEFAULT_STATE };
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
        } catch (err) {
            console.warn('[state] failed to persist:', err);
        }
    }

    get(key) {
        return this._state[key];
    }

    getAll() {
        return { ...this._state };
    }

    set(key, value) {
        const old = this._state[key];
        if (old === value) return;
        this._state[key] = value;
        this._persist();
        // Notify key subscribers
        const subs = this._subscribers.get(key);
        if (subs) for (const cb of [...subs]) {
            try { cb(value, old); } catch (e) { console.error('[state subscriber]', e); }
        }
        // Notify global subscribers
        for (const cb of [...this._globalSubs]) {
            try { cb(key, value, old); } catch (e) { console.error('[state global subscriber]', e); }
        }
    }

    setMany(updates) {
        for (const [k, v] of Object.entries(updates)) this.set(k, v);
    }

    subscribe(key, cb) {
        if (!this._subscribers.has(key)) this._subscribers.set(key, new Set());
        this._subscribers.get(key).add(cb);
        return () => this._subscribers.get(key)?.delete(cb);
    }

    subscribeAll(cb) {
        this._globalSubs.add(cb);
        return () => this._globalSubs.delete(cb);
    }

    reset() {
        this._state = { ...DEFAULT_STATE };
        this._persist();
    }

    updateWindowState(appId, patch) {
        const cur = this._state.windowStates[appId] || {};
        this._state.windowStates[appId] = { ...cur, ...patch };
        this._persist();
    }
}

let _instance = null;
export function getState() {
    if (!_instance) _instance = new StateManager();
    return _instance;
}

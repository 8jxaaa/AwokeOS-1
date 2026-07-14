/**
 * Event Bus — global publish/subscribe for inter-module communication.
 * Pattern: singleton with namespaced events.
 *
 * Usage:
 *   bus.on('app:opened', (app) => { ... });
 *   bus.emit('app:opened', app);
 *   bus.once('boot:complete', () => { ... });
 *   bus.off('app:opened', handler);
 */

class EventBus {
    constructor() {
        this._handlers = new Map(); // event -> Set of handlers
    }

    on(event, handler) {
        if (typeof handler !== 'function') return;
        if (!this._handlers.has(event)) this._handlers.set(event, new Set());
        this._handlers.get(event).add(handler);
        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    once(event, handler) {
        const wrap = (...args) => {
            this.off(event, wrap);
            handler(...args);
        };
        return this.on(event, wrap);
    }

    off(event, handler) {
        const set = this._handlers.get(event);
        if (set) set.delete(handler);
    }

    emit(event, payload) {
        const set = this._handlers.get(event);
        if (!set) return;
        // Copy so handlers can unsubscribe during iteration
        for (const h of [...set]) {
            try {
                h(payload);
            } catch (err) {
                console.error(`[bus] handler for "${event}" threw:`, err);
            }
        }
    }

    /** Clear all listeners for an event (or all events). */
    clear(event) {
        if (event) this._handlers.delete(event);
        else this._handlers.clear();
    }

    /** Listener count for debugging. */
    size(event) {
        if (event) return this._handlers.get(event)?.size || 0;
        let n = 0;
        for (const set of this._handlers.values()) n += set.size;
        return n;
    }
}

export const bus = new EventBus();

/* Canonical event names — exported as constants to avoid typos */
export const EVENTS = Object.freeze({
    BOOT_PROGRESS: 'boot:progress',
    BOOT_COMPLETE: 'boot:complete',
    THEME_CHANGED: 'theme:changed',
    ACCENT_CHANGED: 'accent:changed',
    WALLPAPER_CHANGED: 'wallpaper:changed',
    SETTINGS_CHANGED: 'settings:changed',
    DESKTOP_SWITCH: 'desktop:switch',
    DESKTOP_WIDGET_TOGGLE: 'desktop:widget:toggle',
    RECYCLE_BIN_EMPTY: 'recycle:empty',
    RECYCLE_BIN_RESTORE: 'recycle:restore',
    APP_REGISTERED: 'app:registered',
    APP_OPENED: 'app:opened',
    APP_CLOSED: 'app:closed',
    APP_FOCUSED: 'app:focused',
    WINDOW_OPEN: 'window:open',
    WINDOW_CLOSE: 'window:close',
    WINDOW_FOCUS: 'window:focus',
    WINDOW_MOVE: 'window:move',
    WINDOW_RESIZE: 'window:resize',
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    WINDOW_RESTORE: 'window:restore',
    START_MENU_TOGGLE: 'startmenu:toggle',
    CONTEXT_MENU_OPEN: 'contextmenu:open',
    CONTEXT_MENU_CLOSE: 'contextmenu:close',
    QUICK_SETTINGS_TOGGLE: 'quicksettings:toggle',
    NOTIF_TOGGLE: 'notif:toggle',
    SEARCH_TOGGLE: 'search:toggle',
    FS_CHANGE: 'fs:change',
    FS_RENAME: 'fs:rename',
    FS_DELETE: 'fs:delete',
    FS_CREATE: 'fs:create',
    FS_PASTE: 'fs:paste',
    NOTIFICATION: 'notification',
    TOAST: 'toast',
    SHORTCUT: 'shortcut',
    CLIPBOARD_COPY: 'clipboard:copy',
    CLIPBOARD_CUT: 'clipboard:cut',
    POWER_SHUTDOWN: 'power:shutdown',
    POWER_RESTART: 'power:restart',
    POWER_LOCK: 'power:lock',
    TIME_TICK: 'time:tick'
});

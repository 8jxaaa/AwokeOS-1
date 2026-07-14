/**
 * Window Manager — singleton that owns all windows.
 *
 * Responsibilities:
 *   - Create windows from app definitions
 *   - Track focus stack & z-index
 *   - Handle singleton vs multi-instance apps
 *   - Persist window state via state manager
 *   - Taskbar integration via events
 */

import { Window } from './window.js';
import { bus, EVENTS } from '../core/event-bus.js';
import { getAppRegistry } from '../core/app-registry.js';
import { getState } from '../core/state-manager.js';

class WindowManager {
    constructor() {
        /** @type {Map<string, Window>} */
        this.windows = new Map();
        /** @type {string[]} z-order, last = topmost */
        this.zStack = [];
        this.baseZ = 100;
        this.container = null;
        this._zCounter = this.baseZ;
        this._setupListeners();
    }

    static getInstance() {
        if (!WindowManager._instance) WindowManager._instance = new WindowManager();
        return WindowManager._instance;
    }

    mount(container) {
        this.container = container || document.getElementById('windows-layer');
    }

    _setupListeners() {
        bus.on(EVENTS.APP_OPENED, ({ id }) => this.openApp(id));
        bus.on(EVENTS.WINDOW_FOCUS, ({ id }) => this._focusWindow(id));
        bus.on(EVENTS.WINDOW_CLOSE, ({ id }) => {
            const win = this.windows.get(id);
            if (win) {
                this.windows.delete(id);
                this.zStack = this.zStack.filter(z => z !== id);
                this._notifyTaskbar();
            }
        });
        bus.on(EVENTS.WINDOW_MINIMIZE, () => this._notifyTaskbar());
        bus.on(EVENTS.WINDOW_RESTORE, () => this._notifyTaskbar());
        bus.on(EVENTS.WINDOW_MAXIMIZE, () => this._notifyTaskbar());
        bus.on(EVENTS.WINDOW_MOVE, () => this._notifyTaskbar());
        bus.on(EVENTS.WINDOW_RESIZE, () => this._notifyTaskbar());
        // Snap & Split
        bus.on(EVENTS.WINDOW_SNAP, ({ id, edge }) => this._snapToEdge(id, edge));
        bus.on(EVENTS.WINDOW_SPLIT, ({ id }) => this._splitWindow(id));
        // Pin / Always on top
        bus.on(EVENTS.WINDOW_PIN, ({ id }) => this._togglePin(id));
        // PiP
        bus.on(EVENTS.WINDOW_PIP, ({ id }) => this._togglePiP(id));
        // Shake to minimize
        bus.on(EVENTS.WINDOW_SHAKE, ({ id }) => this._shakeToMinimize(id));
        // Desktop switch
        bus.on(EVENTS.DESKTOP_SWITCH, ({ idx }) => this._switchDesktop(idx));
        // Click on desktop to deselect / unfocus
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window')) return;
            if (e.target.closest('.desktop-icon')) return;
            if (e.target.closest('.taskbar')) return;
            // unfocus topmost window
            this._blurAll();
        });
    }

    _snapToEdge(id, edge) {
        const w = this.windows.get(id);
        if (!w || !w.element) return;
        const cw = window.innerWidth;
        const ch = window.innerHeight - 52;
        const gap = 4;
        if (edge === 'left') {
            w.element.style.transform = `translateX(${gap}px)`;
            w.element.style.width = (cw / 2 - gap * 2) + 'px';
        } else if (edge === 'right') {
            w.element.style.transform = `translateX(${cw / 2 + gap}px)`;
            w.element.style.width = (cw / 2 - gap * 2) + 'px';
        } else if (edge === 'top') {
            w.element.style.transform = `translateY(${gap}px)`;
        } else if (edge === 'bottom') {
            w.element.style.transform = `translateY(${ch / 2 + gap}px)`;
        }
        bus.emit(EVENTS.TOAST, { message: `Snapped to ${edge}`, duration: 1500 });
    }

    _splitWindow(id) {
        const w = this.windows.get(id);
        if (!w || !w.element) return;
        const cw = window.innerWidth;
        const ch = window.innerHeight - 52;
        w.element.style.left = 0;
        w.element.style.top = 0;
        w.element.style.width = (cw / 2 - 4) + 'px';
        w.element.style.height = ch + 'px';
    }

    _togglePin(id) {
        const w = this.windows.get(id);
        if (!w || !w.element) return;
        const current = w.element.style.zIndex;
        if (current === '9999') {
            w.element.style.zIndex = '';
            bus.emit(EVENTS.TOAST, { message: 'Unpinned', duration: 1500 });
        } else {
            w.element.style.zIndex = '9999';
            bus.emit(EVENTS.TOAST, { message: 'Pinned to top', duration: 1500 });
        }
    }

    _togglePiP(id) {
        const w = this.windows.get(id);
        if (!w || !w.element) return;
        const pip = w.element.classList.toggle('pip');
        if (pip) {
            w.element.style.position = 'fixed';
            w.element.style.bottom = '16px';
            w.element.style.right = '16px';
            w.element.style.width = '320px';
            w.element.style.height = '240px';
            w.element.style.zIndex = '2147483646';
            bus.emit(EVENTS.TOAST, { message: 'PiP mode', duration: 1500 });
        } else {
            w.element.style.position = '';
            w.element.style.zIndex = '';
            this._restoreWindow(w.id);
        }
    }

    _shakeToMinimize(id) {
        const w = this.windows.get(id);
        if (!w || !w.element) return;
        w.element.style.animation = 'shake 0.3s ease-in-out';
        setTimeout(() => {
            if (w) w.minimize();
        }, 320);
    }

    _switchDesktop(idx) {
        for (const [id, w] of this.windows) {
            if (w.state !== 'minimized') w.minimize();
        }
    }

    /**
     * Open an app by id. Loads module if needed, creates window.
     */
    async openApp(appId, options = {}) {
        const registry = getAppRegistry();
        let app = registry.get(appId);
        if (!app) {
            try {
                app = await registry.load(appId);
            } catch (err) {
                console.error('[wm] failed to load app:', appId, err);
                return null;
            }
        }
        if (!app) return null;

        // Singleton — focus existing if any
        if (app.singleton) {
            for (const win of this.windows.values()) {
                if (win.appId === appId) {
                    win.unminimize();
                    this._focusWindow(win.id);
                    return win;
                }
            }
        }

        // Auto-load per-app stylesheet (./apps/{id}/styles.css) if it exists
        this._loadAppStyles(appId);

        // Render app content
        let content;
        try {
            content = app.render ? await app.render({
                windowId: options.windowId,
                args: options.args || {}
            }) : null;
        } catch (err) {
            console.error('[wm] app render failed:', appId, err);
            content = errorContent(err);
        }

        // Resolve icon: app.icon may be string key, function, or SVG string
        const iconKey = app.icon || 'app';

        const win = new Window({
            id: options.id,
            appId,
            title: app.name || appId,
            icon: iconKey,
            content,
            size: options.size || app.defaultSize || { width: 800, height: 560 },
            minSize: app.minSize,
            position: options.position,
            resizable: app.resizable !== false,
            maximizable: app.maximizable !== false,
            minizable: app.minimizable !== false,
            closable: app.closable !== false,
            singleton: !!app.singleton
        });

        // Mount
        this.windows.set(win.id, win);
        this.container.appendChild(win.element);
        this._focusWindow(win.id);

        // Run app.init if defined
        if (app.init) {
            try { await app.init({ windowId: win.id }); } catch (e) { console.warn('[wm] app init:', e); }
        }

        // Run app.onMount if defined (post-render hook)
        if (app.onMount) {
            try { await app.onMount({ windowId: win.id, element: content }); } catch (e) { console.warn('[wm] app onMount:', e); }
        }

        // Restore previous bounds if available
        const saved = getState().get('windowStates')?.[appId];
        if (saved && !options.position && !options.size) {
            win.position = { x: saved.x, y: saved.y };
            win.size = { width: saved.w, height: saved.h };
            win._applyBounds();
            if (saved.state === 'maximized') win.maximize();
        }

        this._notifyTaskbar();
        bus.emit(EVENTS.WINDOW_OPEN, { id: win.id, appId });
        return win;
    }

    closeWindow(id) {
        const win = this.windows.get(id);
        if (win) win.close();
    }

    closeAll() {
        for (const w of [...this.windows.values()]) w.close();
    }

    closeApp(appId) {
        for (const [id, win] of this.windows.entries()) {
            if (win.appId === appId) win.close();
        }
    }

    getWindow(id) { return this.windows.get(id); }

    listWindows() { return [...this.windows.values()]; }

    listByApp(appId) {
        return [...this.windows.values()].filter(w => w.appId === appId);
    }

    _focusWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        // Move to top
        this.zStack = this.zStack.filter(z => z !== id);
        this.zStack.push(id);
        this._zCounter++;
        win.element.style.zIndex = this._zCounter;
        // Mark focused
        for (const w of this.windows.values()) {
            w.focused = (w.id === id);
            w.element.classList.toggle('focused', w.focused);
        }
        bus.emit(EVENTS.APP_FOCUSED, { id, appId: win.appId });
        this._notifyTaskbar();
    }

    _blurAll() {
        for (const w of this.windows.values()) {
            w.focused = false;
            w.element.classList.remove('focused');
        }
    }

    _notifyTaskbar() {
        // Re-render taskbar list
        bus.emit('taskbar:refresh');
    }

    _loadedStyles = new Set();
    _loadAppStyles(appId) {
        if (this._loadedStyles.has(appId)) return;
        this._loadedStyles.add(appId);
        const href = `apps/${appId}/styles.css`;
        // Probe by attempting to fetch with no-cors and checking size
        fetch(href, { method: 'HEAD' }).then(r => {
            if (r.ok) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.dataset.appStyle = appId;
                document.head.appendChild(link);
            }
        }).catch(() => { /* no stylesheet for this app */ });
    }
}

function errorContent(err) {
    const div = document.createElement('div');
    div.style.cssText = 'padding:24px;color:var(--text-secondary);';
    div.innerHTML = `<h3 style="color:var(--text-color);margin-bottom:8px;">App failed to load</h3>
        <pre style="font-family:var(--font-mono);font-size:12px;background:var(--bg-input);padding:12px;border-radius:8px;overflow:auto;">${(err?.message || err || 'Unknown error').toString().replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>`;
    return div;
}

export { WindowManager };

/**
 * App registry — registers, lists, and loads applications.
 * Each app is a module exporting a default object with id, name, icon, etc.
 * Apps are dynamically imported so the kernel stays small.
 *
 * App module shape:
 *   export default {
 *     id: 'file-explorer',
 *     name: 'File Explorer',
 *     icon: 'folder',          // icon id from assets/icons.js (or inline SVG string)
 *     category: 'system',
 *     singleton: false,
 *     defaultSize: { w: 900, h: 600 },
 *     minSize: { w: 400, h: 300 },
 *     init: async (context) => { ... }   // optional setup
 *     render: async (context) => HTMLElement   // returns root element
 *     onClose?: async (context) => void
 *   }
 */

import { bus, EVENTS } from './event-bus.js';
import { uid } from '../utils/id.js';
import { settings } from '../services/persistence-service.js';

const INSTALLED_KEY = 'installed-apps';

class AppRegistry {
    constructor() {
        /** @type {Map<string, object>} */
        this.apps = new Map();
        /** @type {Map<string, Promise<object>>} module-import promises */
        this._pending = new Map();
        /** @type {Set<string>} ids of installed (visible in start menu) apps */
        this.installed = new Set(settings.get(INSTALLED_KEY, null) || this._defaultInstalled());
    }

    _defaultInstalled() {
        return [
            'file-explorer','terminal','calculator','settings','notes',
            'text-editor','paint','markdown-editor','image-viewer',
            'music-player','video-player','browser','calendar','clock',
            'task-manager','app-store','weather','recycle-bin'
        ];
    }

    /** Register an app module. */
    register(appModule) {
        if (!appModule || !appModule.id) {
            console.warn('[registry] invalid app module:', appModule);
            return;
        }
        this.apps.set(appModule.id, {
            singleton: false,
            category: 'utility',
            ...appModule
        });
        bus.emit(EVENTS.APP_REGISTERED, appModule.id);
    }

    /** Bulk-register app modules. */
    registerAll(appModules) {
        for (const m of appModules) this.register(m);
    }

    /** Get app by id. */
    get(id) {
        return this.apps.get(id);
    }

    /** Get all registered apps. */
    list() {
        return [...this.apps.values()];
    }

    /** Get installed (visible to user) apps. */
    listInstalled() {
        const out = [];
        for (const id of this.installed) {
            const app = this.apps.get(id);
            if (app) out.push(app);
        }
        // Sort by category then name
        return out.sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.name.localeCompare(b.name);
        });
    }

    /** Mark app installed. */
    install(id) {
        this.installed.add(id);
        this._persistInstalled();
    }

    uninstall(id) {
        this.installed.delete(id);
        this._persistInstalled();
    }

    isInstalled(id) {
        return this.installed.has(id);
    }

    _persistInstalled() {
        settings.set(INSTALLED_KEY, [...this.installed]);
    }

    /**
     * Lazily import an app module by id.
     * Convention: app id maps to /apps/{id}/index.js
     */
    async load(id) {
        if (this._pending.has(id)) return this._pending.get(id);
        if (this.apps.has(id)) return this.apps.get(id);

        const p = (async () => {
            try {
                const mod = await import(`../apps/${id}/index.js`);
                const appModule = mod.default || mod;
                this.register(appModule);
                return appModule;
            } catch (err) {
                console.error(`[registry] failed to load app "${id}":`, err);
                throw err;
            } finally {
                this._pending.delete(id);
            }
        })();
        this._pending.set(id, p);
        return p;
    }

    /** Preload a list of apps for fast launch. */
    async preload(ids = []) {
        return Promise.allSettled(ids.map(id => this.load(id)));
    }
}

let _instance = null;
export function getAppRegistry() {
    if (!_instance) _instance = new AppRegistry();
    return _instance;
}

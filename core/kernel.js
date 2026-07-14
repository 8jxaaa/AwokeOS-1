/**
 * Kernel — the main boot orchestrator.
 *
 * Boot sequence:
 *   1. Apply theme (instant)
 *   2. Show boot screen
 *   3. Initialize persistence
 *   4. Initialize window manager
 *   5. Initialize desktop shell
 *   6. Preload installed apps
 *   7. Open startup apps
 *   8. Hide boot screen
 *   9. Register global shortcuts
 *  10. Register service worker (offline)
 */

import { bus, EVENTS } from './event-bus.js';
import { getState } from './state-manager.js';
import { getAppRegistry } from './app-registry.js';
import { getThemeService } from '../services/theme-service.js';
import { getNotificationService } from '../services/notification-service.js';
import { shortcuts } from '../utils/shortcuts.js';
import { wait } from '../utils/dom.js';

// We'll import window manager and desktop shell lazily inside boot
// so the kernel file is independent of those modules for clean architecture.

const BOOT_STEPS = [
    { id: 'theme', label: 'Applying theme…', weight: 5 },
    { id: 'persistence', label: 'Mounting storage…', weight: 10 },
    { id: 'window-manager', label: 'Initializing window manager…', weight: 15 },
    { id: 'desktop', label: 'Building desktop…', weight: 15 },
    { id: 'taskbar', label: 'Building taskbar…', weight: 10 },
    { id: 'search', label: 'Loading search…', weight: 5 },
    { id: 'apps-registry', label: 'Loading apps registry…', weight: 10 },
    { id: 'apps-preload', label: 'Preloading apps…', weight: 20 },
    { id: 'startup', label: 'Opening startup apps…', weight: 10 },
    { id: 'shortcuts', label: 'Registering shortcuts…', weight: 5 }
];

class Kernel {
    constructor() {
        this.bootStart = performance.now();
        this.booted = false;
    }

    async boot() {
        if (this.booted) return;
        this.booted = true;
        console.log('%c[AwokeOS]%c Booting kernel…', 'color:#6366f1;font-weight:bold', 'color:inherit');

        // Warn if opened via file:// (ES modules require a server)
        if (window.location.protocol === 'file:') {
            this._showBootError('Cannot run from file://\n\nAwokeOS uses ES modules which require a local web server.\n\nRun:\n  python3 -m http.server 8080\nThen open http://localhost:8080');
            return;
        }

        // 1. Apply theme immediately so boot screen looks correct
        const theme = getThemeService();
        theme.injectAllCustom();
        theme.applyAll();

        // 2. Show boot progress
        const progressBar = document.getElementById('boot-progress-bar');
        const statusEl = document.getElementById('boot-status');
        const bootScreen = document.getElementById('boot-screen');

        const totalWeight = BOOT_STEPS.reduce((a, s) => a + s.weight, 0);
        let completed = 0;

        const update = (label) => {
            const pct = Math.min(100, (completed / totalWeight) * 100);
            if (progressBar) progressBar.style.width = pct + '%';
            if (statusEl) statusEl.textContent = label;
            bus.emit(EVENTS.BOOT_PROGRESS, { pct, label });
        };

        for (const step of BOOT_STEPS) {
            update(step.label);
            try {
                await this._runStep(step.id);
            } catch (err) {
                console.error(`[kernel] step "${step.id}" failed:`, err);
            }
            completed += step.weight;
            await wait(40); // make boot feel smooth even if instant
        }

        update('Ready');
        await wait(150);

        // Reveal desktop
        if (bootScreen) {
            bootScreen.classList.add('fade-out');
            setTimeout(() => bootScreen.remove(), 400);
        }
        document.getElementById('desktop')?.classList.remove('hidden');
        document.getElementById('taskbar')?.classList.remove('hidden');

        // First-boot setup wizard
        const state = getState();
        if (state.get('firstBoot')) {
            setTimeout(() => {
                import('../desktop/setup-wizard.js').then(mod => {
                    mod.showSetupWizard();
                });
            }, 800);
        }

        bus.emit(EVENTS.BOOT_COMPLETE, { durationMs: performance.now() - this.bootStart });
        console.log(`%c[AwokeOS]%c Booted in ${Math.round(performance.now() - this.bootStart)}ms`, 'color:#6366f1;font-weight:bold', 'color:inherit');

        this._registerGlobalShortcuts();
        this._registerServiceWorker();
    }

    _showBootError(message) {
        const statusEl = document.getElementById('boot-status');
        const bootScreen = document.getElementById('boot-screen');
        if (statusEl) {
            statusEl.textContent = 'Boot failed';
            const pre = document.createElement('pre');
            pre.style.cssText = 'margin-top:24px;padding:16px;background:rgba(0,0,0,0.5);border-radius:8px;max-width:80%;text-align:left;font-family:var(--font-mono);font-size:12px;line-height:1.5;color:#ff9999;white-space:pre-wrap;';
            pre.textContent = message;
            bootScreen?.querySelector('.boot-logo')?.appendChild(pre);
        }
    }

    async _runStep(id) {
        switch (id) {
            case 'theme': {
                // already done above
                break;
            }
            case 'persistence': {
                // Initialize notification service (needs DOM hooks)
                getNotificationService();
                break;
            }
            case 'window-manager': {
                const { WindowManager } = await import('../window-manager/window-manager.js');
                WindowManager.getInstance().mount(document.getElementById('windows-layer'));
                break;
            }
            case 'desktop': {
                const { Desktop } = await import('../desktop/desktop.js');
                Desktop.getInstance().mount();
                break;
            }
            case 'taskbar': {
                const { Taskbar } = await import('../desktop/taskbar.js');
                Taskbar.getInstance().mount();
                break;
            }
            case 'search': {
                // Load search module so its bus listener is registered
                await import('../desktop/search.js');
                break;
            }
            case 'apps-registry': {
                const reg = getAppRegistry();
                // Eagerly register core apps we know exist (so desktop icons show)
                await reg.preload(['file-explorer','terminal','calculator','settings','notes','browser']);
                break;
            }
            case 'apps-preload': {
                const reg = getAppRegistry();
                const state = getState();
                // Preload all installed apps in background
                const toLoad = reg.listInstalled().filter(a => !reg.get(a.id));
                if (toLoad.length) {
                    // Don't block boot — preload in background
                    reg.preload(toLoad.map(a => a.id)).catch(() => {});
                }
                break;
            }
            case 'startup': {
                const state = getState();
                const startupApps = state.get('startupApps') || [];
                const reg = getAppRegistry();
                // Wait for registry to know apps
                for (const id of startupApps) {
                    try {
                        const app = reg.get(id) || await reg.load(id);
                        if (app) {
                            bus.emit(EVENTS.APP_OPENED, { id });
                        }
                    } catch (e) {
                        console.warn('[kernel] startup app failed:', id, e);
                    }
                }
                break;
            }
            case 'shortcuts': {
                // shortcuts registered separately
                break;
            }
        }
    }

    _registerGlobalShortcuts() {
        // Open start menu
        shortcuts.bind('mod+space', () => bus.emit(EVENTS.START_MENU_TOGGLE), { scope: 'global' });
        shortcuts.bind('super', () => bus.emit(EVENTS.START_MENU_TOGGLE), { scope: 'global' });
        // Search
        shortcuts.bind('mod+k', () => bus.emit(EVENTS.SEARCH_TOGGLE), { scope: 'global' });
        // Quick settings
        shortcuts.bind('mod+a', () => bus.emit(EVENTS.QUICK_SETTINGS_TOGGLE), { scope: 'global' });
        // Notification center
        shortcuts.bind('mod+n', () => bus.emit(EVENTS.NOTIF_TOGGLE), { scope: 'global' });
        // Lock
        shortcuts.bind('mod+l', () => bus.emit(EVENTS.POWER_LOCK), { scope: 'global' });
        // Escape closes overlays
        shortcuts.bind('esc', () => bus.emit('overlay:close', null), { scope: 'global' });
    }

    _registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(err => {
                    console.warn('[kernel] service worker registration failed:', err);
                });
            });
        }
    }
}

const kernel = new Kernel();
window.AwokeOS = window.AwokeOS || {};
window.AwokeOS.kernel = kernel;
window.AwokeOS.bus = bus;
window.AwokeOS.state = getState();
window.AwokeOS.registry = getAppRegistry();
window.AwokeOS.theme = getThemeService();
window.AwokeOS.notifications = getNotificationService();

// Boot as soon as DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => kernel.boot());
} else {
    kernel.boot();
}

export default kernel;

/**
 * Taskbar — bottom bar with start button, pinned apps, running apps, clock, system tray.
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { getState } from '../core/state-manager.js';
import { getAppRegistry } from '../core/app-registry.js';
import { icon } from '../assets/icons.js';
import { h } from '../utils/dom.js';
import { shortcuts } from '../utils/shortcuts.js';
import { showStartMenu } from './start-menu.js';
import { QuickSettings } from './quick-settings.js';

class Taskbar {
    constructor() {
        this.element = null;
        this.clockEl = null;
        this.timeEl = null;
        this.dateEl = null;
        this.appListEl = null;
    }
    static getInstance() {
        if (!Taskbar._instance) Taskbar._instance = new Taskbar();
        return Taskbar._instance;
    }

    mount() {
        this.element = document.getElementById('taskbar');
        if (!this.element) return;
        applyTaskbarSettings();
        this._render();
        this._startClock();
        bus.on('taskbar:refresh', () => this._render());
        bus.on(EVENTS.APP_OPENED, () => this._render());
        bus.on(EVENTS.WINDOW_CLOSE, () => this._render());
        bus.on(EVENTS.WINDOW_MINIMIZE, () => this._render());
        bus.on(EVENTS.WINDOW_RESTORE, () => this._render());
    }

    _render() {
        if (!this.element) return;
        this.element.innerHTML = '';
        const state = getState();
        const reg = getAppRegistry();

        // Left: Start, Search
        const left = h('div', { class: 'taskbar-left' }, [
            this._iconBtn('app', 'Start', () => bus.emit(EVENTS.START_MENU_TOGGLE), { id: 'start-btn' }),
            this._iconBtn('search', 'Search', () => bus.emit(EVENTS.SEARCH_TOGGLE)),
            this._iconBtn('task', 'Task view', () => this._showTaskView())
        ]);
        this.element.appendChild(left);

        // Center: pinned + running apps
        this.appListEl = h('div', { class: 'taskbar-center' });
        const pinned = state.get('pinnedApps') || [];
        const seen = new Set();
        // Show pinned first
        for (const id of pinned) {
            const app = reg.get(id);
            if (!app) continue;
            seen.add(id);
            this.appListEl.appendChild(this._appButton(app));
        }
        // Then running apps not already shown
        const wm = window.AwokeOS?.kernel;
        // We rely on taskbar:refresh from window manager instead of direct access
        // But we also need to read the running apps list — we listen via DOM
        this.element.appendChild(this.appListEl);
        this._refreshRunningApps();

        // Right: system tray + indicators + clock
        const right = h('div', { class: 'taskbar-right' }, [
            // Quick settings
            this._iconBtn('chevron-up', 'Quick settings', (e) => {
                e.stopPropagation();
                QuickSettings.getInstance().toggle();
            }, { id: 'quick-settings-btn' }),
            // System tray
            h('div', { class: 'systray', style: { display: 'flex', alignItems: 'center', gap: '2px' } }, [
                // Battery indicator
                h('div', { style: { width: '12px', height: '12px', borderRadius: '2px', background: 'var(--accent)', opacity: '.7' }, title: 'Battery' }),
                // Wi-Fi indicator
                h('div', { html: icon('wifi'), style: { width: '14px', height: '14px', opacity: '.6' }, title: 'Wi-Fi' }),
                // Bluetooth indicator
                h('div', { html: icon('bluetooth'), style: { width: '14px', height: '14px', opacity: '.6' }, title: 'Bluetooth' }),
                // Sound
                h('div', { html: icon('volume-2'), style: { width: '14px', height: '14px', opacity: '.6' }, title: 'Sound' }),
            ]),
            // Notification bell with badge
            h('div', { style: { position: 'relative' } }, [
                this._iconBtn('bell', 'Notifications', (e) => {
                    e.stopPropagation();
                    bus.emit(EVENTS.NOTIF_TOGGLE);
                }, { id: 'notif-btn' }),
                h('div', { class: 'notif-badge', style: {
                    position: 'absolute', top: '-2px', right: '-2px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: 'var(--accent)',
                    display: state.get('notificationsEnabled') && !state.get('doNotDisturb') ? '' : 'none'
                }})
            ]),
            this._clock()
        ]);
        this.element.appendChild(right);
    }

    _iconBtn(iconKey, title, onClick, opts = {}) {
        return h('button', {
            class: 'taskbar-btn',
            'aria-label': title,
            title,
            id: opts.id,
            html: icon(iconKey),
            onClick
        });
    }

    _appButton(app) {
        const win = this._findWindowByApp(app.id);
        const btn = h('button', {
            class: ['taskbar-app', win ? 'has-window' : '', win?.focused ? 'active' : ''],
            title: app.name,
            dataset: { appId: app.id },
            onClick: () => this._onAppClick(app.id)
        }, [
            h('span', { class: 'taskbar-app-icon', html: icon(app.icon) }),
            h('span', { class: 'taskbar-app-label' }, app.name)
        ]);
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._showAppContextMenu(app, e.clientX, e.clientY);
        });
        return btn;
    }

    _onAppClick(appId) {
        const reg = getAppRegistry();
        const app = reg.get(appId);
        if (!app) return;

        // Singleton: focus existing
        if (app.singleton) {
            const win = this._findWindowByApp(appId);
            if (win) {
                win.focus();
                return;
            }
        }
        // Otherwise: open or focus topmost
        const wins = this._findWindowsByApp(appId);
        if (wins.length === 0) {
            bus.emit(EVENTS.APP_OPENED, { id: appId });
        } else {
            const top = wins[wins.length - 1];
            top.focus();
        }
    }

    _showAppContextMenu(app, x, y) {
        import('./context-menu.js').then(({ openContextMenu }) => {
            openContextMenu(x, y, [
                { label: app.name, disabled: true },
                { separator: true },
                { label: 'Open new window', icon: 'plus', onClick: () => bus.emit(EVENTS.APP_OPENED, { id: app.id }) },
                { label: 'Unpin from taskbar', icon: 'minus', onClick: () => {
                    const pins = (getState().get('pinnedApps') || []).filter(id => id !== app.id);
                    getState().set('pinnedApps', pins);
                    bus.emit('taskbar:refresh');
                }},
                { separator: true },
                { label: 'Close all windows', icon: 'x', danger: true, onClick: () => {
                    const wm = window.AwokeOS?.kernel;
                    // Use global bus path
                    bus.emit('window:close-app', { appId: app.id });
                }}
            ]);
        });
    }

    _findWindowByApp(appId) {
        // Walk all .window DOM nodes (lightweight)
        return this._findWindowsByApp(appId)[0];
    }
    _findWindowsByApp(appId) {
        const wins = [];
        const layer = document.getElementById('windows-layer');
        if (!layer) return wins;
        for (const el of layer.querySelectorAll('.window')) {
            if (el.dataset.app === appId) {
                // Find the Window instance by id
                const id = el.dataset.id;
                const wm = window.AwokeOS?.registry; // not the wm, but we don't expose it globally
                // Easier: just reference the element
                wins.push({
                    id,
                    focused: el.classList.contains('focused'),
                    element: el,
                    focus() {
                        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    }
                });
            }
        }
        return wins;
    }

    _refreshRunningApps() {
        if (!this.appListEl) return;
        // Find currently running apps in DOM
        const layer = document.getElementById('windows-layer');
        if (!layer) return;
        const reg = getAppRegistry();
        const pinned = new Set(getState().get('pinnedApps') || []);
        const present = new Set();
        const focusedApps = new Set();
        for (const el of layer.querySelectorAll('.window')) {
            present.add(el.dataset.app);
            if (el.classList.contains('focused')) focusedApps.add(el.dataset.app);
        }

        // Batch DOM updates via a fragment
        const fragment = document.createDocumentFragment();
        const currentBtns = [...this.appListEl.querySelectorAll('.taskbar-app')];
        const currentById = new Map(currentBtns.map(b => [b.dataset.appId, b]));
        const nextIds = new Set(pinned);
        for (const appId of present) nextIds.add(appId);

        for (const appId of nextIds) {
            let btn = currentById.get(appId);
            if (!btn) {
                const app = reg.get(appId);
                if (!app) continue;
                btn = this._appButton(app);
            }
            btn.classList.toggle('active', focusedApps.has(appId));
            btn.classList.toggle('has-window', present.has(appId));
            fragment.appendChild(btn);
        }
        // Remove stale
        for (const btn of currentBtns) {
            if (!nextIds.has(btn.dataset.appId)) btn.remove();
        }
        if (this.appListEl.childNodes.length !== fragment.childNodes.length || ![...this.appListEl.children].every((c, i) => c === fragment.children[i])) {
            this.appListEl.appendChild(fragment);
        }
    }

    _clock() {
        this.timeEl = h('div', { class: 'taskbar-clock-time' }, '--:--');
        this.dateEl = h('div', { class: 'taskbar-clock-date' }, '');
        const clk = h('button', {
            class: 'taskbar-clock',
            onClick: () => bus.emit(EVENTS.APP_OPENED, { id: 'clock' })
        }, [this.timeEl, this.dateEl]);
        clk.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            import('./context-menu.js').then(({ openContextMenu }) => {
                openContextMenu(e.clientX, e.clientY, [
                    { label: 'Adjust date & time', icon: 'clock', onClick: () => bus.emit(EVENTS.APP_OPENED, { id: 'settings' }) },
                    { separator: true },
                    { label: 'Open Calendar', icon: 'calendar', onClick: () => bus.emit(EVENTS.APP_OPENED, { id: 'calendar' }) }
                ]);
            });
        });
        return clk;
    }

    _startClock() {
        const update = () => {
            const now = new Date();
            if (this.timeEl) this.timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (this.dateEl) this.dateEl.textContent = now.toLocaleDateString([], { day: '2-digit', month: 'short' });
            bus.emit(EVENTS.TIME_TICK, now);
        };
        update();
        setInterval(update, 30000);
    }

    _showTaskView() {
        // Simple task view: show all windows side by side
        const layer = document.getElementById('windows-layer');
        if (!layer) return;
        const wins = layer.querySelectorAll('.window');
        if (wins.length === 0) return;
        const cols = Math.ceil(Math.sqrt(wins.length));
        const rows = Math.ceil(wins.length / cols);
        const tb = document.getElementById('taskbar');
        const tbH = tb ? tb.offsetHeight : 52;
        const W = window.innerWidth / cols;
        const H = (window.innerHeight - tbH) / rows;
        wins.forEach((el, i) => {
            const c = i % cols;
            const r = Math.floor(i / cols);
            const origTransition = el.style.transition;
            el.style.transition = 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.left = (c * W + 4) + 'px';
            el.style.top = (r * H + 4) + 'px';
            el.style.width = (W - 8) + 'px';
            el.style.height = (H - 8) + 'px';
            setTimeout(() => { el.style.transition = origTransition; }, 250);
        });
        setTimeout(() => this._render(), 300);
    }
}

export function applyTaskbarSettings() {
    const state = getState();
    const tb = document.getElementById('taskbar');
    if (!tb) return;
    tb.classList.remove('top', 'left', 'right');
    const pos = state.get('taskbarPosition') || 'bottom';
    if (pos !== 'bottom') tb.classList.add(pos);
    tb.classList.toggle('auto-hide', !!state.get('taskbarAutoHide'));
    const layer = document.getElementById('windows-layer');
    if (layer) {
        layer.style.top = pos === 'top' ? 'var(--taskbar-height)' : '0';
        layer.style.left = pos === 'left' ? 'var(--taskbar-height)' : '0';
        layer.style.right = pos === 'right' ? 'var(--taskbar-height)' : '0';
        layer.style.bottom = pos === 'bottom' ? 'var(--taskbar-height)' : '0';
    }
    const desktop = document.getElementById('desktop');
    if (desktop) {
        const icons = desktop.querySelector('.desktop-icons');
        if (icons) {
            icons.style.top = pos === 'top' ? 'calc(var(--taskbar-height) + var(--space-4))' : 'var(--space-4)';
            icons.style.left = pos === 'left' ? 'calc(var(--taskbar-height) + var(--space-4))' : 'var(--space-4)';
            icons.style.right = pos === 'right' ? 'calc(var(--taskbar-height) + var(--space-4))' : 'var(--space-4)';
            icons.style.bottom = pos === 'bottom' ? 'calc(var(--taskbar-height) + var(--space-4))' : 'var(--space-4)';
        }
    }
}

export { Taskbar };

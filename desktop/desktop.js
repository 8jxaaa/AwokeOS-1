/**
 * Desktop — wallpaper + icons + selection.
 *
 * Renders the icons container, applies wallpaper, handles icon double-click to open apps,
 * and right-click for context menu.
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { getState } from '../core/state-manager.js';
import { getAppRegistry } from '../core/app-registry.js';
import { applyWallpaper } from '../assets/wallpapers.js';
import { icon as renderIcon } from '../assets/icons.js';
import { h } from '../utils/dom.js';
import { openContextMenu } from './context-menu.js';

const DESKTOP_ICONS_KEY = 'desktop-icons';

class Desktop {
    constructor() {
        this.element = null;
        this.wallpaperEl = null;
        this.iconsEl = null;
        this.iconPositions = this._loadPositions();
    }
    static getInstance() {
        if (!Desktop._instance) Desktop._instance = new Desktop();
        return Desktop._instance;
    }

    _loadPositions() {
        return getState().get('desktopIconPositions') || {};
    }

    _savePositions() {
        getState().set('desktopIconPositions', this.iconPositions);
    }

    mount() {
        this.element = document.getElementById('desktop');
        this.wallpaperEl = document.getElementById('desktop-wallpaper');
        this.iconsEl = document.getElementById('desktop-icons');
        if (!this.element) return;

        this._applyWallpaper();
        this._renderIcons();
        this._setupListeners();

        // Listen for theme/wallpaper changes
        bus.on(EVENTS.WALLPAPER_CHANGED, () => this._applyWallpaper());
        bus.on(EVENTS.APP_REGISTERED, () => this._renderIcons());
        bus.on('desktop:refresh', () => this._renderIcons());

        // Wallpaper slideshow
        this._initSlideshow();
    }

    _initSlideshow() {
        const state = getState();
        const interval = state.get('slideshowInterval') || 300;
        const enabled = state.get('slideshow') !== false;
        if (!enabled) return;
        const wpIds = ['aurora', 'sunset', 'ocean', 'space', 'cyber', 'dark', 'light'];
        let idx = 0;
        setInterval(() => {
            state.set('wallpaper', wpIds[idx]);
            idx = (idx + 1) % wpIds.length;
            bus.emit(EVENTS.WALLPAPER_CHANGED, wpIds[idx]);
        }, interval * 1000);
    }

    _applyWallpaper() {
        if (!this.wallpaperEl) return;
        const state = getState();
        const wpId = state.get('wallpaper') || 'aurora';
        const apply = () => {
            if (wpId === 'custom') {
                const url = state.get('customWallpaper');
                if (url) {
                    this.wallpaperEl.style.background = `url('${url}') center/cover no-repeat`;
                    this.wallpaperEl.style.backgroundAttachment = 'fixed';
                    return;
                }
            }
            applyWallpaper(this.wallpaperEl, wpId);
        };
        if (this.wallpaperEl.style.opacity === '0') {
            apply();
            this.wallpaperEl.style.opacity = '1';
            return;
        }
        this.wallpaperEl.style.opacity = '0';
        setTimeout(() => {
            apply();
            this.wallpaperEl.style.opacity = '1';
        }, 260);
    }

    _renderIcons() {
        if (!this.iconsEl) return;
        this.iconsEl.innerHTML = '';
        const reg = getAppRegistry();
        const state = getState();
        const desktopApps = ['file-explorer','terminal','browser','notes','calculator','settings','paint','markdown-editor'];
        // Also show 'recycle-bin' if installed
        if (reg.get('recycle-bin')) desktopApps.push('recycle-bin');
        const ordered = state.get('desktopIconOrder') || [];
        const sorted = [...desktopApps].sort((a, b) => {
            const ai = ordered.indexOf(a), bi = ordered.indexOf(b);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });
        desktopApps.forEach((id) => {
            const app = reg.get(id);
            if (!app) return;
            const iconEl = this._renderIcon(app, id);
            this.iconsEl.appendChild(iconEl);
        });
        // Auto-arrange: snap to grid
        this._autoArrange();
    }

    _autoArrange() {
        const children = [...this.iconsEl.children];
        const gridCols = Math.max(1, Math.floor(this.iconsEl.offsetWidth / 96));
        children.forEach((el, i) => {
            const col = i % gridCols;
            const row = Math.floor(i / gridCols);
            el.style.gridColumn = (col + 1) + '';
            el.style.gridRow = (row + 1) + '';
        });
    }

    _renderIcon(app, appId) {
        const el = h('div', {
            class: 'dicon',
            dataset: { appId: app.id },
            onDblclick: () => bus.emit(EVENTS.APP_OPENED, { id: app.id }),
            onClick: (e) => this._selectIcon(el, e)
        }, [
            h('div', { class: 'dicon-img', html: renderIcon(app.icon) }),
            h('div', { class: 'dicon-label' }, app.name)
        ]);

        // Drag-to-reposition (snaps to grid)
        this._makeIconDraggable(el, app.id);

        // Context menu
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._selectIcon(el, e);
            openContextMenu(e.clientX, e.clientY, this._iconContextMenu(app));
        });

        return el;
    }

    _iconContextMenu(app) {
        return [
            { label: 'Open', icon: 'arrow-right', onClick: () => bus.emit(EVENTS.APP_OPENED, { id: app.id }) },
            { separator: true },
            { label: 'Pin to taskbar', icon: 'plus', onClick: () => {
                const pins = getState().get('pinnedApps') || [];
                if (!pins.includes(app.id)) {
                    pins.push(app.id);
                    getState().set('pinnedApps', pins);
                    bus.emit('taskbar:refresh');
                    bus.emit(EVENTS.TOAST, { type: 'success', message: `Pinned ${app.name}`, duration: 2000 });
                }
            }},
            { label: 'Properties', icon: 'info', onClick: () => {
                bus.emit(EVENTS.TOAST, { title: app.name, message: app.description || `${app.category} app`, duration: 3500 });
            }}
        ];
    }

    _selectIcon(el, e) {
        // Deselect others
        for (const i of this.iconsEl.querySelectorAll('.dicon.selected')) i.classList.remove('selected');
        el.classList.add('selected');
        e?.stopPropagation();
    }

    _makeIconDraggable(el, appId) {
        let dragging = false, sx, sy, startIdx = -1, moved = false;
        let dragThreshold = 12;
        el.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            dragging = true;
            moved = false;
            sx = e.clientX; sy = e.clientY;
            startIdx = [...this.iconsEl.children].indexOf(el);
        });
        el.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - sx;
            const dy = e.clientY - sy;
            if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
                moved = true;
                const rect = el.getBoundingClientRect();
                const iconsRect = this.iconsEl.getBoundingClientRect();
                el.style.left = (rect.left - iconsRect.left) + 'px';
                el.style.top = (rect.top - iconsRect.top) + 'px';
                el.style.zIndex = '10';
                el.classList.add('dragging');
                el.setPointerCapture(e.pointerId);
            }
            if (moved) {
                el.style.transform = `translate(${dx}px, ${dy}px)`;
            }
        });
        el.addEventListener('pointerup', () => {
            if (!dragging) return;
            dragging = false;
            el.style.zIndex = '';
            el.classList.remove('dragging');
            el.style.transform = '';
            el.style.left = '';
            el.style.top = '';
            if (moved) {
                // Snap to nearest grid slot
                const iconsRect = this.iconsEl.getBoundingClientRect();
                const rect = el.getBoundingClientRect();
                const relX = rect.left - iconsRect.left;
                const relY = rect.top - iconsRect.top;
                const col = Math.round(relX / 96);
                const row = Math.round(relY / 116);
                const children = [...this.iconsEl.children];
                const totalCols = Math.max(1, Math.floor(iconsRect.width / 96));
                const newIdx = Math.max(0, Math.min(children.length - 1, row * totalCols + col));
                if (newIdx !== startIdx) {
                    if (newIdx < startIdx) {
                        this.iconsEl.insertBefore(el, children[newIdx]);
                    } else {
                        this.iconsEl.insertBefore(el, children[newIdx + 1]);
                    }
                }
                this._saveIconOrder();
            }
        });
        el.addEventListener('pointercancel', () => {
            if (!dragging) return;
            dragging = false;
            el.style.zIndex = '';
            el.classList.remove('dragging');
            el.style.transform = '';
            el.style.left = '';
            el.style.top = '';
        });
    }

    _saveIconOrder() {
        const order = [...this.iconsEl.querySelectorAll('.dicon')].map(el => el.dataset.appId);
        getState().set('desktopIconOrder', order);
    }

    _setupListeners() {
        // Right-click on empty desktop
        this.element.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.dicon')) return; // handled per-icon
            e.preventDefault();
            openContextMenu(e.clientX, e.clientY, [
                { label: 'Refresh', icon: 'refresh', onClick: () => bus.emit('desktop:refresh') },
                { separator: true },
                { label: 'New folder', icon: 'folder', onClick: async () => {
                    bus.emit('fs:create-folder', { parentPath: '/Desktop', name: 'New folder' });
                }},
                { label: 'Change wallpaper', icon: 'image', onClick: () => {
                    import('./quick-settings.js').then(m => m.QuickSettings.getInstance().open());
                }},
                { separator: true },
                { label: 'Open Settings', icon: 'settings', onClick: () => bus.emit(EVENTS.APP_OPENED, { id: 'settings' }) }
            ]);
        });
    }
}

export { Desktop };

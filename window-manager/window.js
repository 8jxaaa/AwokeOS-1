/**
 * Window — a single application window.
 * Provides drag (header), resize (8 handles), minimize/maximize/close,
 * focus management, animations, and snap-on-drag.
 *
 * Events emitted (via bus):
 *   window:open, window:focus, window:move, window:resize,
 *   window:minimize, window:maximize, window:restore, window:close
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { h } from '../utils/dom.js';
import { icon } from '../assets/icons.js';
import { detectSnap, snapBounds, showSnapPreview, hideSnapPreview, SNAP_REGIONS } from './snap-layout.js';
import { getState } from '../core/state-manager.js';
import { uid } from '../utils/id.js';

const HEADER_HEIGHT = 36;

export class Window {
    /**
     * @param {object} opts
     * @param {string} opts.id - unique window id
     * @param {string} opts.appId - app identifier
     * @param {string} opts.title - window title
     * @param {string} [opts.icon] - icon key or SVG
     * @param {HTMLElement} [opts.content] - already rendered app content (or null)
     * @param {{width:number,height:number}} [opts.size]
     * @param {{x:number,y:number}} [opts.position]
     * @param {boolean} [opts.resizable=true]
     * @param {boolean} [opts.maximizable=true]
     * @param {boolean} [opts.minimizable=true]
     * @param {boolean} [opts.closable=true]
     * @param {boolean} [opts.singleton=false]
     */
    constructor(opts) {
        this.id = opts.id || uid('win');
        this.appId = opts.appId;
        this.title = opts.title || 'Untitled';
        this.icon = opts.icon || 'app';
        this.content = opts.content || null;
        this.resizable = opts.resizable !== false;
        this.maximizable = opts.maximizable !== false;
        this.minimizable = opts.minimizable !== false;
        this.closable = opts.closable !== false;
        this.singleton = !!opts.singleton;
        this.minSize = opts.minSize || { width: 320, height: 220 };

        // Bounds
        const taskbar = document.getElementById('taskbar');
        const tbH = taskbar ? taskbar.offsetHeight : 52;
        const maxW = window.innerWidth;
        const maxH = window.innerHeight - tbH;

        this.size = clampSize(opts.size || { width: 800, height: 560 }, this.minSize, { width: maxW, height: maxH });
        this.position = clampPosition(opts.position || this._defaultPosition(), this.size, tbH);

        // State
        this.state = 'normal'; // normal | maximized | snapped-left | snapped-right | snapped-tl | snapped-tr
        this.previousBounds = null;
        this.focused = false;
        this.closing = false;
        this.minimizing = false;

        // Build element
        this.element = this._buildElement();
        this._applyBounds();
        this._installBehaviors();
    }

    _defaultPosition() {
        // Cascading position based on number of existing windows
        const layer = document.getElementById('windows-layer') || document.body;
        const existing = layer.querySelectorAll('.window').length;
        const offset = (existing % 8) * 30;
        const w = this.size.width, h = this.size.height;
        return {
            x: Math.max(0, Math.floor((window.innerWidth - w) / 2) + offset - 120),
            y: Math.max(0, Math.floor((window.innerHeight - h - 52) / 2) + offset - 80)
        };
    }

    _buildElement() {
        const header = h('div', { class: 'window-header', dataset: { role: 'drag' } }, [
            h('div', { class: 'window-icon', html: icon(this.icon) }),
            h('div', { class: 'window-title', dataset: { role: 'title' } }, this.title),
            this._buildControls()
        ]);
        const body = h('div', { class: 'window-body', dataset: { role: 'body' } });
        if (this.content) body.appendChild(this.content);
        const el = h('div', {
            class: 'window',
            dataset: { id: this.id, app: this.appId }
        }, [header, body]);
        return el;
    }

    _buildControls() {
        const ctrls = [];
        if (this.minimizable) {
            ctrls.push(h('button', {
                class: 'window-btn minimize',
                'aria-label': 'Minimize',
                title: 'Minimize',
                html: icon('minimize'),
                onClick: (e) => { e.stopPropagation(); this.minimize(); }
            }));
        }
        if (this.maximizable) {
            ctrls.push(h('button', {
                class: 'window-btn maximize',
                'aria-label': 'Maximize',
                title: 'Maximize',
                html: icon('maximize'),
                onClick: (e) => { e.stopPropagation(); this.toggleMaximize(); }
            }));
        }
        if (this.closable) {
            ctrls.push(h('button', {
                class: 'window-btn close',
                'aria-label': 'Close',
                title: 'Close',
                html: icon('close'),
                onClick: (e) => { e.stopPropagation(); this.close(); }
            }));
        }
        return h('div', { class: 'window-controls' }, ctrls);
    }

    _applyBounds() {
        const { x, y } = this.position;
        const { width, height } = this.size;
        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
    }

    _installBehaviors() {
        // Focus on mousedown anywhere
        this.element.addEventListener('mousedown', () => this.focus());
        this.element.addEventListener('touchstart', () => this.focus(), { passive: true });

        // Drag
        this._installDrag();

        // Double-click header to maximize/restore
        const header = this.element.querySelector('.window-header');
        header.addEventListener('dblclick', (e) => {
            if (e.target.closest('.window-controls')) return;
            if (this.maximizable) this.toggleMaximize();
        });

        // Resize handles
        if (this.resizable) this._installResize();
    }

    /* ============== Drag ============== */
    _installDrag() {
        const header = this.element.querySelector('.window-header');
        let startX, startY, origX, origY, dragging = false;
        let rafId = 0;
        let pendingPt = null;

        const onDown = (e) => {
            if (e.target.closest('.window-controls')) return;
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            dragging = true;
            const pt = pointer(e);
            startX = pt.x; startY = pt.y;
            origX = this.position.x; origY = this.position.y;
            this.element.style.transition = 'none';
            this.element.style.willChange = 'left, top';
            this.element.classList.add('moving');
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };
        const flushMove = () => {
            if (!pendingPt || !dragging) return;
            const pt = pendingPt;
            pendingPt = null;
            const dx = pt.x - startX;
            const dy = pt.y - startY;
            const tb = document.getElementById('taskbar');
            const tbH = tb ? tb.offsetHeight : 52;

            // Snap detection
            const zone = detectSnap(pt.x, pt.y);
            showSnapPreview(zone);

            if (zone) {
                if (zone === SNAP_REGIONS.TOP || zone === SNAP_REGIONS.MAXIMIZE) {
                    this.element.style.transform = '';
                }
            } else {
                this.position.x = Math.max(-this.size.width + 100, Math.min(window.innerWidth - 100, origX + dx));
                this.position.y = Math.max(0, Math.min(window.innerHeight - tbH - 24, origY + dy));
                this.element.style.left = this.position.x + 'px';
                this.element.style.top = this.position.y + 'px';
                this.element.style.transform = '';
                if (this.state !== 'normal') this._setState('normal');
            }
        };
        const onMove = (e) => {
            if (!dragging) return;
            pendingPt = pointer(e);
            if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; flushMove(); });
        };
        const onUp = (e) => {
            if (!dragging) return;
            dragging = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
            pendingPt = null;
            flushMove();
            this.element.style.transition = '';
            this.element.style.willChange = '';
            this.element.classList.remove('moving');
            document.body.style.userSelect = '';
            const pt = pointer(e);
            const zone = detectSnap(pt.x, pt.y);
            hideSnapPreview();
            if (zone) this._snapTo(zone);
            this._saveBounds();
            bus.emit(EVENTS.WINDOW_MOVE, { id: this.id, position: this.position });
        };

        header.addEventListener('pointerdown', onDown);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
    }

    /* ============== Resize ============== */
    _installResize() {
        const dirs = ['n','s','e','w','ne','nw','se','sw'];
        for (const dir of dirs) {
            const handle = h('div', { class: ['window-resize-handle', dir], dataset: { dir } });
            this.element.appendChild(handle);
            this._installResizeHandle(handle, dir);
        }
    }

    _installResizeHandle(handle, dir) {
        let startX, startY, origX, origY, origW, origH, resizing = false;
        let rafId = 0;
        let pendingPt = null;

        const onDown = (e) => {
            if (this.state === 'maximized' || this.state.startsWith('snapped')) return;
            e.stopPropagation();
            resizing = true;
            const pt = pointer(e);
            startX = pt.x; startY = pt.y;
            origX = this.position.x; origY = this.position.y;
            origW = this.size.width; origH = this.size.height;
            this.element.style.transition = 'none';
            this.element.style.willChange = 'left, top, width, height';
            document.body.style.userSelect = 'none';
        };
        const flushResize = () => {
            if (!pendingPt || !resizing) return;
            const pt = pendingPt;
            pendingPt = null;
            const dx = pt.x - startX;
            const dy = pt.y - startY;
            let x = origX, y = origY, w = origW, h = origH;
            if (dir.includes('e')) w = Math.max(this.minSize.width, origW + dx);
            if (dir.includes('s')) h = Math.max(this.minSize.height, origH + dy);
            if (dir.includes('w')) {
                w = Math.max(this.minSize.width, origW - dx);
                x = origX + (origW - w);
            }
            if (dir.includes('n')) {
                h = Math.max(this.minSize.height, origH - dy);
                y = origY + (origH - h);
            }
            this.position = { x, y };
            this.size = { width: w, height: h };
            this.element.style.left = x + 'px';
            this.element.style.top = y + 'px';
            this.element.style.width = w + 'px';
            this.element.style.height = h + 'px';
        };
        const onMove = (e) => {
            if (!resizing) return;
            pendingPt = pointer(e);
            if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; flushResize(); });
        };
        const onUp = () => {
            if (!resizing) return;
            resizing = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
            pendingPt = null;
            flushResize();
            this.element.style.transition = '';
            this.element.style.willChange = '';
            document.body.style.userSelect = '';
            this._saveBounds();
            bus.emit(EVENTS.WINDOW_RESIZE, { id: this.id, size: this.size });
        };

        handle.addEventListener('pointerdown', onDown);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
    }

    _snapTo(zone) {
        const bounds = snapBounds(zone);
        if (!bounds) return;
        this.previousBounds = { position: { ...this.position }, size: { ...this.size } };
        this.position = { x: bounds.x, y: bounds.y };
        this.size = { width: bounds.width, height: bounds.height };
        this.element.classList.add('snapping');
        this._applyBounds();
        setTimeout(() => this.element.classList.remove('snapping'), 220);
        this._setState(zone === SNAP_REGIONS.LEFT ? 'snapped-left'
            : zone === SNAP_REGIONS.RIGHT ? 'snapped-right'
            : zone === SNAP_REGIONS.TOP_LEFT ? 'snapped-tl'
            : zone === SNAP_REGIONS.TOP_RIGHT ? 'snapped-tr'
            : 'maximized');
        bus.emit(EVENTS.WINDOW_MAXIMIZE, { id: this.id, zone });
    }

    /* ============== State transitions ============== */
    toggleMaximize() {
        if (this.state === 'maximized' || this.state.startsWith('snapped')) {
            this.restore();
        } else {
            this.maximize();
        }
    }

    maximize() {
        if (this.state === 'maximized') return;
        this.previousBounds = { position: { ...this.position }, size: { ...this.size } };
        const tb = document.getElementById('taskbar');
        const tbH = tb ? tb.offsetHeight : 52;
        this.position = { x: 0, y: 0 };
        this.size = { width: window.innerWidth, height: window.innerHeight - tbH };
        this.element.classList.add('snapping');
        this._applyBounds();
        setTimeout(() => this.element.classList.remove('snapping'), 220);
        this.element.classList.add('maximized');
        this._setState('maximized');
        bus.emit(EVENTS.WINDOW_MAXIMIZE, { id: this.id });
    }

    restore() {
        if (this.state === 'normal') return;
        if (this.previousBounds) {
            this.position = this.previousBounds.position;
            this.size = this.previousBounds.size;
            this._applyBounds();
        }
        this.element.classList.remove('maximized');
        this._setState('normal');
        this._saveBounds();
        bus.emit(EVENTS.WINDOW_RESTORE, { id: this.id });
    }

    minimize() {
        if (this.state === 'minimized') return;
        this._previousState = this.state;
        this._setState('minimized');
        this.element.classList.add('minimizing');
        setTimeout(() => {
            this.element.style.display = 'none';
            this.element.classList.remove('minimizing');
        }, 260);
        bus.emit(EVENTS.WINDOW_MINIMIZE, { id: this.id });
    }

    unminimize() {
        if (this.state !== 'minimized') return;
        this._setState(this._previousState || 'normal');
        this.element.style.display = '';
        this.element.classList.remove('minimizing');
        this.element.classList.add('restoring');
        setTimeout(() => this.element.classList.remove('restoring'), 260);
        bus.emit(EVENTS.WINDOW_RESTORE, { id: this.id });
    }

    focus() {
        if (this.state === 'minimized') this.unminimize();
        bus.emit(EVENTS.WINDOW_FOCUS, { id: this.id });
    }

    _setState(s) {
        this.state = s;
        this.element.dataset.state = s;
    }

    close() {
        if (this.closing) return;
        this.closing = true;
        this.element.classList.add('closing');
        bus.emit(EVENTS.WINDOW_CLOSE, { id: this.id, appId: this.appId });
        setTimeout(() => {
            this.element.remove();
        }, 170);
    }

    setTitle(title) {
        this.title = title;
        const t = this.element.querySelector('.window-title');
        if (t) t.textContent = title;
    }

    setIcon(iconKey) {
        this.icon = iconKey;
        const i = this.element.querySelector('.window-icon');
        if (i) i.innerHTML = icon(iconKey);
    }

    setContent(content) {
        const body = this.element.querySelector('.window-body');
        body.innerHTML = '';
        if (content) body.appendChild(content);
    }

    _saveBounds() {
        if (this.state === 'normal' || this.state === 'minimized') {
            getState().updateWindowState(this.appId, {
                x: this.position.x, y: this.position.y,
                w: this.size.width, h: this.size.height,
                state: this.state
            });
        }
    }
}

function clampSize(size, min, max) {
    return {
        width: Math.max(min.width, Math.min(max.width, size.width)),
        height: Math.max(min.height, Math.min(max.height, size.height))
    };
}
function clampPosition(pos, size, taskbarH) {
    return {
        x: Math.max(0, Math.min(window.innerWidth - 100, pos.x)),
        y: Math.max(0, Math.min(window.innerHeight - taskbarH - 24, pos.y))
    };
}
function pointer(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

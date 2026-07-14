/**
 * Virtual Desktop Manager — manage multiple desktops with their own state.
 * Each desktop has: wallpaper, icon positions, open windows, widgets.
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { getState } from '../core/state-manager.js';
import { h, clear } from '../utils/dom.js';
import { getAppRegistry } from '../core/app-registry.js';
import { applyWallpaper } from '../assets/wallpapers.js';
import { icon } from '../assets/icons.js';

let _desktops = [];
let _activeIdx = 0;
let _layer = null;

export function initVirtualDesktops(windowsLayerEl) {
    _layer = windowsLayerEl;
    const state = getState();
    const saved = state.get('virtualDesktops') || [];
    if (saved.length) {
        _desktops = saved.map(d => ({ ...d, windows: [] }));
        _activeIdx = state.get('activeDesktop') || 0;
    } else {
        _desktops = [{ name: 'Desktop 1', wallpaper: 'aurora', windows: [] }];
    }
    return _desktops;
}

export function getDesktops() { return _desktops; }

export function getActiveDesktop() { return _desktops[_activeIdx]; }

export function getActiveIndex() { return _activeIdx; }

export function addDesktop(name = `Desktop ${_desktops.length + 1}`) {
    _desktops.push({ name, wallpaper: 'aurora', windows: [] });
    _activeIdx = _desktops.length - 1;
    _save();
    _render();
}

export function removeDesktop(idx) {
    if (_desktops.length <= 1) return;
    _desktops.splice(idx, 1);
    if (_activeIdx >= _desktops.length) _activeIdx = _desktops.length - 1;
    _save();
    _render();
}

export function switchDesktop(idx) {
    if (idx < 0 || idx >= _desktops.length) return;
    _activeIdx = idx;
    // Move all windows from current desktop to hidden
    const current = _desktops[idx];
    _save();
    bus.emit(EVENTS.DESKTOP_SWITCH, { idx, name: current.name });
    _render();
}

export function renameDesktop(idx, name) {
    _desktops[idx].name = name;
    _save();
    _render();
}

export function setDesktopWallpaper(idx, wpId) {
    _desktops[idx].wallpaper = wpId;
    _save();
    if (idx === _activeIdx) {
        bus.emit(EVENTS.WALLPAPER_CHANGED, wpId);
    }
}

function _save() {
    getState().set('virtualDesktops', _desktops.map(d => ({ name: d.name, wallpaper: d.wallpaper })));
    getState().set('activeDesktop', _activeIdx);
}

function _render() {
    bus.emit('desktop:refresh', _activeIdx);
}

export function showDesktopSwitcher() {
    const overlay = h('div', { class: 'desktop-switcher-overlay', style: {
        position: 'fixed', bottom: 'calc(var(--taskbar-height) + 8px)', left: '8px',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px',
        background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,.5)', maxWidth: '300px'
    }});
    _desktops.forEach((d, i) => {
        const btn = h('button', {
            class: 'desktop-btn' + (i === _activeIdx ? ' active' : ''),
            style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', cursor: 'pointer' },
            onClick: () => { switchDesktop(i); overlay.remove(); }
        }, [
            h('span', {}, `#${i + 1}`),
            h('span', { style: { flex: 1, fontSize: '14px' } }, d.name || `Desktop ${i + 1}`),
            _desktops.length > 1 ? h('button', { style: { fontSize: '12px', opacity: '.6' }, onClick: (e) => { e.stopPropagation(); removeDesktop(i); overlay.remove(); } }, '×') : null
        ]);
        overlay.appendChild(btn);
    });
    // Add new
    const addBtn = h('button', {
        style: { padding: '8px', borderRadius: '8px', fontSize: '13px', color: 'var(--accent)', cursor: 'pointer' },
        onClick: () => { addDesktop(); overlay.remove(); }
    }, '+ New Desktop');
    overlay.appendChild(addBtn);
    document.body.appendChild(overlay);
    setTimeout(() => {
        document.addEventListener('mousedown', (e) => {
            if (!overlay.contains(e.target)) overlay.remove();
        }, { once: true });
    }, 0);
}

// Listen for desktop switch keyboard shortcut
bus.on(EVENTS.DESKTOP_SWITCH, (idx) => switchDesktop(idx));
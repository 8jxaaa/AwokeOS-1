/**
 * Context Menu — right-click menu system.
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { h, clear } from '../utils/dom.js';
import { icon } from '../assets/icons.js';

let _menu = null;
let _onCloseHandler = null;

/**
 * Open a context menu at (x, y).
 * @param {number} x
 * @param {number} y
 * @param {Array} items - [{ label, icon, shortcut, onClick, danger, disabled, separator }]
 */
export function openContextMenu(x, y, items = []) {
    closeContextMenu();

    const root = document.getElementById('context-menu-root');
    if (!root) return;

    const menuItems = items.map((item, idx) => {
        if (item.separator) return h('div', { class: 'context-menu-separator', key: idx });
        return h('div', {
            class: ['context-menu-item', item.danger ? 'danger' : '', item.disabled ? 'disabled' : ''],
            dataset: { idx },
            onClick: (e) => {
                if (item.disabled) return;
                closeContextMenu();
                setTimeout(() => item.onClick?.(e), 0);
            }
        }, [
            item.icon ? h('span', { class: 'context-menu-item-icon', html: icon(item.icon) }) : h('span', { class: 'context-menu-item-icon' }),
            h('span', { class: 'context-menu-item-label' }, item.label || ''),
            item.shortcut ? h('span', { class: 'context-menu-item-shortcut' }, item.shortcut) : null
        ]);
    });

    _menu = h('div', { class: 'context-menu' }, menuItems);
    root.appendChild(_menu);

    // Position with viewport collision avoidance
    requestAnimationFrame(() => {
        if (!_menu) return;
        const rect = _menu.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        let posX = x, posY = y;
        if (posX + rect.width > vw) posX = vw - rect.width - 4;
        if (posY + rect.height > vh) posY = vh - rect.height - 4;
        _menu.style.left = posX + 'px';
        _menu.style.top = posY + 'px';
    });

    _onCloseHandler = (e) => {
        if (!_menu) return;
        if (!_menu.contains(e.target)) closeContextMenu();
    };
    setTimeout(() => document.addEventListener('mousedown', _onCloseHandler), 0);
    document.addEventListener('keydown', _escClose);

    bus.emit(EVENTS.CONTEXT_MENU_OPEN);
}

export function closeContextMenu() {
    if (_menu) {
        _menu.remove();
        _menu = null;
    }
    if (_onCloseHandler) {
        document.removeEventListener('mousedown', _onCloseHandler);
        _onCloseHandler = null;
    }
    document.removeEventListener('keydown', _escClose);
    bus.emit(EVENTS.CONTEXT_MENU_CLOSE);
}

function _escClose(e) { if (e.key === 'Escape') closeContextMenu(); }

// Global right-click handler — auto-open for elements with [data-context-menu]
bus.on('overlay:close', () => closeContextMenu());

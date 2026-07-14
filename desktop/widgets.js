/**
 * Desktop Widgets — pinned panels that show on the desktop sides.
 * Each widget can be a clock, weather, calendar, notes, etc.
 */

import { h } from '../utils/dom.js';
import { getState } from '../core/state-manager.js';
import { bus, EVENTS } from '../core/event-bus.js';
import { icon } from '../assets/icons.js';

const DEFAULT_WIDGETS = [
    { id: 'clock', type: 'clock', enabled: true, position: 'top-right' },
    { id: 'weather', type: 'weather', enabled: true, position: 'top-right' },
    { id: 'calendar', type: 'calendar', enabled: false, position: 'bottom-left' }
];

export function initWidgets() {
    const state = getState();
    const saved = state.get('widgets') || [];
    if (!saved.length) {
        state.set('widgets', DEFAULT_WIDGETS);
    }
}

export function getWidgets() {
    const state = getState();
    return state.get('widgets') || [];
}

export function toggleWidget(id) {
    const state = getState();
    const widgets = state.get('widgets') || [];
    const idx = widgets.findIndex(w => w.id === id);
    if (idx >= 0) {
        widgets[idx].enabled = !widgets[idx].enabled;
    } else {
        widgets.push({ id, type: 'custom', enabled: true, position: 'top-right' });
    }
    state.set('widgets', widgets);
    bus.emit(EVENTS.DESKTOP_WIDGET_TOGGLE, id);
}

export function renderWidgets(container) {
    const state = getState();
    const widgets = state.get('widgets') || [];
    widgets.filter(w => w.enabled).forEach(w => {
        const el = h('div', { class: 'desktop-widget', 'data-widget': w.id, style: {
            position: 'absolute', padding: '8px', borderRadius: '8px',
            background: 'var(--bg-elevated)', backdropFilter: 'blur(4px)',
            fontSize: '12px', pointerEvents: 'auto', cursor: 'default'
        }});
        // Position by type
        if (w.position === 'top-right') {
            el.style.top = '8px';
            el.style.right = '8px';
        } else if (w.position === 'bottom-left') {
            el.style.bottom = '40px';
            el.style.left = '8px';
        }
        container.appendChild(el);
    });
}
/**
 * Start Menu — overlay with search and app grid.
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { getState } from '../core/state-manager.js';
import { getAppRegistry } from '../core/app-registry.js';
import { icon } from '../assets/icons.js';
import { h, clear } from '../utils/dom.js';

let _menu = null;

export function showStartMenu() {
    if (_menu) return _menu;
    const root = document.getElementById('start-menu-root');
    if (!root) return null;

    const state = getState();
    const reg = getAppRegistry();

    const searchInput = h('input', {
        type: 'text',
        placeholder: 'Search apps and files…',
        onInput: (e) => filter(e.target.value),
        onKeyDown: (e) => {
            if (e.key === 'Enter') {
                const first = root.querySelector('.start-menu-app:not(.hidden)');
                if (first) { first.click(); hideStartMenu(); }
            } else if (e.key === 'Escape') {
                hideStartMenu();
            }
        }
    });
    // Auto-focus search
    setTimeout(() => searchInput.focus(), 50);

    const grid = h('div', { class: 'start-menu-apps', id: 'start-menu-apps' });
    const allApps = reg.listInstalled();

    const renderApp = (app, idx) => {
        const el = h('div', {
            class: 'start-menu-app',
            dataset: { appId: app.id, name: app.name.toLowerCase() },
            style: { animationDelay: (idx * 20) + 'ms' },
            onClick: () => {
                bus.emit(EVENTS.APP_OPENED, { id: app.id });
                hideStartMenu();
            }
        }, [
            h('div', { class: 'start-menu-app-icon', html: icon(app.icon) }),
            h('div', { class: 'start-menu-app-name' }, app.name)
        ]);
        return el;
    };

    // Group by category
    const grouped = {};
    for (const app of allApps) {
        const cat = app.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(app);
    }

    // Pinned section
    const pinned = state.get('pinnedApps') || [];
    const pinnedApps = pinned.map(id => reg.get(id)).filter(Boolean);

    const sections = [];
    if (pinnedApps.length) {
        const frag = document.createDocumentFragment();
        pinnedApps.forEach((app, i) => frag.appendChild(renderApp(app, i)));
        sections.push(h('div', { class: 'start-menu-section' }, [
            h('div', { class: 'start-menu-section-title' }, 'Pinned'),
            h('div', { class: 'start-menu-apps' }, [frag])
        ]));
    }
    let idxOffset = pinnedApps.length;
    for (const [cat, apps] of Object.entries(grouped)) {
        const frag = document.createDocumentFragment();
        apps.forEach((app, i) => frag.appendChild(renderApp(app, idxOffset + i)));
        idxOffset += apps.length;
        sections.push(h('div', { class: 'start-menu-section' }, [
            h('div', { class: 'start-menu-section-title' }, cat.charAt(0).toUpperCase() + cat.slice(1)),
            h('div', { class: 'start-menu-apps' }, [frag])
        ]));
    }

    const filter = (q) => {
        q = q.toLowerCase().trim();
        requestAnimationFrame(() => {
            const all = root.querySelectorAll('.start-menu-app');
            for (const a of all) {
                const match = !q || a.dataset.name.includes(q);
                a.classList.toggle('hidden', !match);
            }
            // Hide empty sections
            for (const sec of root.querySelectorAll('.start-menu-section')) {
                const visible = sec.querySelectorAll('.start-menu-app:not(.hidden)');
                sec.style.display = visible.length ? '' : 'none';
            }
        });
    };

    _menu = h('div', { class: 'start-menu', onClick: (e) => e.stopPropagation() }, [
        h('div', { class: 'start-menu-search' }, [searchInput]),
        h('div', { class: 'overflow-auto flex-1' }, sections),
        h('div', { class: 'start-menu-footer' }, [
            h('div', { class: 'start-menu-user' }, [
                h('div', { class: 'start-menu-user-avatar' }, (state.get('username') || 'U').charAt(0).toUpperCase()),
                h('div', {}, state.get('username') || 'User')
            ]),
            h('div', { class: 'flex gap-1' }, [
                h('button', {
                    class: 'start-menu-power-btn',
                    title: 'Lock',
                    html: icon('lock'),
                    onClick: () => bus.emit(EVENTS.POWER_LOCK)
                }),
                h('button', {
                    class: 'start-menu-power-btn',
                    title: 'Power',
                    html: icon('power'),
                    onClick: (e) => {
                        import('./context-menu.js').then(({ openContextMenu }) => {
                            openContextMenu(e.clientX, e.clientY, [
                                { label: 'Sleep', icon: 'moon', onClick: () => bus.emit(EVENTS.POWER_LOCK) },
                                { label: 'Restart', icon: 'refresh', onClick: () => bus.emit(EVENTS.POWER_RESTART) },
                                { label: 'Shut down', icon: 'power', danger: true, onClick: () => bus.emit(EVENTS.POWER_SHUTDOWN) }
                            ]);
                        });
                    }
                })
            ])
        ])
    ]);

    root.appendChild(_menu);

    // Trigger opening animation on next frame so initial state is already rendered
    requestAnimationFrame(() => {
        if (_menu) _menu.classList.add('open');
    });

    // Close on outside click
    setTimeout(() => {
        const onDoc = (e) => {
            if (!_menu) return;
            if (!_menu.contains(e.target) && !e.target.closest('#start-btn')) {
                hideStartMenu();
                document.removeEventListener('mousedown', onDoc);
            }
        };
        document.addEventListener('mousedown', onDoc);
    }, 0);

    bus.emit('overlay:open', 'start-menu');
    return _menu;
}

export function hideStartMenu() {
    if (_menu) {
        _menu.remove();
        _menu = null;
    }
    bus.emit('overlay:close', 'start-menu');
}

export function toggleStartMenu() {
    if (_menu) hideStartMenu();
    else showStartMenu();
}

// Listen for toggle events
bus.on(EVENTS.START_MENU_TOGGLE, () => toggleStartMenu());

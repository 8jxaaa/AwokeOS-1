/**
 * Search overlay — global app/file search.
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { getAppRegistry } from '../core/app-registry.js';
import { icon } from '../assets/icons.js';
import { h } from '../utils/dom.js';

let _overlay = null;

export function openSearch() {
    if (_overlay) return;
    const root = document.getElementById('search-root');
    if (!root) return;

    const input = h('input', {
        type: 'text',
        placeholder: 'Type to search apps, files, settings…',
        autofocus: true,
        onInput: (e) => update(e.target.value),
        onKeyDown: (e) => {
            if (e.key === 'Escape') closeSearch();
            else if (e.key === 'Enter') {
                const active = resultsEl.querySelector('.search-result.focused') || resultsEl.querySelector('.search-result');
                if (active) active.click();
            }
        }
    });

    const resultsEl = h('div', { class: 'search-overlay-results' });

    const update = (q) => {
        resultsEl.innerHTML = '';
        q = (q || '').trim().toLowerCase();
        if (!q) {
            resultsEl.appendChild(h('div', { class: 'empty-state' }, [
                h('div', { html: icon('search') }),
                h('div', {}, 'Start typing to search…')
            ]));
            return;
        }
        const reg = getAppRegistry();
        const items = [];

        // Apps
        for (const app of reg.listInstalled()) {
            if (app.name.toLowerCase().includes(q) || app.id.includes(q) || app.category.includes(q)) {
                items.push({
                    type: 'app',
                    title: app.name,
                    subtitle: app.category,
                    iconKey: app.icon,
                    onClick: () => { openApp(app.id); closeSearch(); }
                });
            }
        }

        // Settings
        const settingsItems = [
            { title: 'Change theme', subtitle: 'Settings → Personalization', iconKey: 'sun',
              onClick: () => { openApp('settings', { tab: 'personalization' }); closeSearch(); }},
            { title: 'Change wallpaper', subtitle: 'Settings → Personalization', iconKey: 'image',
              onClick: () => { openApp('settings', { tab: 'personalization' }); closeSearch(); }},
            { title: 'Manage startup apps', subtitle: 'Settings → Apps', iconKey: 'app',
              onClick: () => { openApp('settings', { tab: 'apps' }); closeSearch(); }}
        ];
        for (const s of settingsItems) {
            if (s.title.toLowerCase().includes(q)) items.push(s);
        }

        // Files (if VFS available)
        if (window.AwokeOS?.vfs) {
            const vfs = window.AwokeOS.vfs;
            vfs.search(q).then(results => {
                for (const f of results.slice(0, 10)) {
                    items.push({
                        type: 'file',
                        title: f.name,
                        subtitle: f.path,
                        iconKey: f.type === 'folder' ? 'folder' : 'file',
                        onClick: () => { openApp('file-explorer', { path: f.parent || '/' }); closeSearch(); }
                    });
                }
                render();
            }).catch(() => render());
        } else {
            render();
        }

        function render() {
            if (items.length === 0) {
                resultsEl.appendChild(h('div', { class: 'empty-state' }, [
                    h('div', {}, `No results for "${q}"`)
                ]));
                return;
            }
            for (const it of items) {
                const el = h('div', { class: 'search-result' }, [
                    h('div', { class: 'search-result-icon', html: icon(it.iconKey) }),
                    h('div', { class: 'search-result-content' }, [
                        h('div', { class: 'search-result-title' }, it.title),
                        it.subtitle ? h('div', { class: 'search-result-subtitle' }, it.subtitle) : null
                    ])
                ]);
                el.addEventListener('click', it.onClick);
                resultsEl.appendChild(el);
            }
        }
    };

    _overlay = h('div', { class: 'search-overlay', onClick: (e) => e.stopPropagation() }, [
        h('div', { class: 'search-overlay-input' }, [input]),
        resultsEl
    ]);

    root.appendChild(_overlay);
    setTimeout(() => input.focus(), 50);
    update('');

    setTimeout(() => {
        const onDoc = (e) => {
            if (!_overlay) return;
            if (!_overlay.contains(e.target)) {
                closeSearch();
                document.removeEventListener('mousedown', onDoc);
            }
        };
        document.addEventListener('mousedown', onDoc);
    }, 0);
    bus.emit('overlay:open', 'search');
}

export function closeSearch() {
    if (_overlay) {
        _overlay.remove();
        _overlay = null;
    }
    bus.emit('overlay:close', 'search');
}

export function toggleSearch() {
    if (_overlay) closeSearch();
    else openSearch();
}

bus.on(EVENTS.SEARCH_TOGGLE, () => toggleSearch());

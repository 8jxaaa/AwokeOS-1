/**
 * Settings — themes, accents, wallpapers, system preferences, etc.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { getState } from '../../core/state-manager.js';
import { getThemeService, THEMES, ACCENTS } from '../../services/theme-service.js';
import { renderThemePicker, renderAccentPicker, renderWallpaperPicker } from '../../themes/theme-manager.js';
import { WALLPAPERS } from '../../assets/wallpapers.js';
import { getVFS } from '../../filesystem/vfs.js';
import { appData } from '../../services/persistence-service.js';
import { bus, EVENTS } from '../../core/event-bus.js';
import { getAppRegistry } from '../../core/app-registry.js';
import { applyTaskbarSettings } from '../../desktop/taskbar.js';

export default {
    id: 'settings',
    name: 'Settings',
    icon: 'settings',
    category: 'System',
    description: 'Configure AwokeOS',
    defaultSize: { width: 900, height: 620 },
    minSize: { width: 600, height: 400 },
    singleton: true,

    async render({ args }) {
        const root = h('div', { class: 'app-root settings-root' });
        const theme = getThemeService();
        const state = getState();
        const reg = getAppRegistry();

        // Sidebar
        const sidebar = h('div', { class: 'settings-sidebar' });
        const content = h('div', { class: 'settings-content scroll-y' });
        const layout = h('div', { class: 'settings-layout' }, [sidebar, content]);
        root.appendChild(layout);

        const sections = [
            { id: 'personalization', label: 'Personalization', icon: 'sun', render: renderPersonalization },
            { id: 'apps', label: 'Apps', icon: 'app', render: renderApps },
            { id: 'system', label: 'System', icon: 'settings', render: renderSystem },
            { id: 'accounts', label: 'Accounts', icon: 'user', render: renderAccounts },
            { id: 'privacy', label: 'Privacy', icon: 'lock', render: renderPrivacy },
            { id: 'storage', label: 'Storage', icon: 'folder', render: renderStorage },
            { id: 'about', label: 'About', icon: 'info', render: renderAbout }
        ];

        for (const sec of sections) {
            const btn = h('button', { class: 'settings-sidebar-item', dataset: { section: sec.id }, onClick: () => showSection(sec) }, [
                h('span', { html: icon(sec.icon) }),
                h('span', {}, sec.label)
            ]);
            sidebar.appendChild(btn);
        }

        function showSection(sec) {
            for (const b of sidebar.querySelectorAll('.settings-sidebar-item')) b.classList.remove('active');
            sidebar.querySelector(`[data-section="${sec.id}"]`).classList.add('active');
            content.innerHTML = '';
            content.appendChild(h('div', { class: 'settings-section' }, [
                h('h2', { class: 'settings-section-title' }, sec.label),
                h('div', { class: 'settings-section-content' }, [sec.render()])
            ]));
        }

        function renderPersonalization() {
            const wrap = h('div', { class: 'flex flex-col gap-4' });
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Theme'),
                renderThemePicker(state.get('theme'), (id) => theme.applyTheme(id))
            ]));
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Accent color'),
                renderAccentPicker(state.get('accent'), (id) => theme.applyAccent(id))
            ]));
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Wallpaper'),
                renderWallpaperPicker(state.get('wallpaper'), (id) => {
                    state.set('wallpaper', id);
                    state.set('customWallpaper', null);
                    bus.emit(EVENTS.WALLPAPER_CHANGED, id);
                }, WALLPAPERS),
                h('div', { class: 'mt-2' }, [
                    h('input', { type: 'file', accept: 'image/*', hidden: true, id: 'settings-wallpaper-input', onChange: async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        try {
                            const vfs = getVFS();
                            await vfs.writeFile('/Pictures/' + file.name, file);
                            const url = URL.createObjectURL(file);
                            state.set('customWallpaper', url);
                            state.set('wallpaper', 'custom');
                            bus.emit(EVENTS.WALLPAPER_CHANGED, 'custom');
                            bus.emit(EVENTS.TOAST, { type: 'success', message: 'Wallpaper updated' });
                        } catch (err) {
                            bus.emit(EVENTS.TOAST, { type: 'error', message: 'Upload failed: ' + err.message });
                        }
                    }}),
                    h('button', { class: 'btn btn-sm', onClick: () => document.getElementById('settings-wallpaper-input').click() }, 'Upload custom wallpaper')
                ])
            ]));
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Visual effects'),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Background transparency'),
                        h('div', { class: 'text-xs text-secondary' }, 'Opacity of window backgrounds')
                    ]),
                    h('input', { class: 'input', type: 'range', min: '0.2', max: '1', step: '0.02', value: state.get('transparency') ?? 0.78, style: { width: '120px' }, onInput: (e) => {
                        state.set('transparency', +e.target.value);
                        theme.applyVisualSettings();
                    }})
                ]),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Blur strength'),
                        h('div', { class: 'text-xs text-secondary' }, 'Amount of background blur')
                    ]),
                    h('input', { class: 'input', type: 'range', min: '0', max: '60', step: '2', value: state.get('blurStrength') ?? 24, style: { width: '120px' }, onInput: (e) => {
                        state.set('blurStrength', +e.target.value);
                        theme.applyVisualSettings();
                    }})
                ]),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Animation speed'),
                        h('div', { class: 'text-xs text-secondary' }, 'Overall UI animation speed')
                    ]),
                    h('select', { class: 'select', style: { width: 'auto' }, onChange: (e) => { state.set('animationSpeed', e.target.value); theme.applyVisualSettings(); } }, [
                        h('option', { value: 'slow', selected: state.get('animationSpeed') === 'slow' ? 'selected' : null }, 'Slow'),
                        h('option', { value: 'normal', selected: state.get('animationSpeed') === 'normal' ? 'selected' : null }, 'Normal'),
                        h('option', { value: 'fast', selected: state.get('animationSpeed') === 'fast' ? 'selected' : null }, 'Fast'),
                        h('option', { value: 'instant', selected: state.get('animationSpeed') === 'instant' ? 'selected' : null }, 'Instant')
                    ])
                ])
            ]));
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Font size'),
                h('div', { class: 'flex gap-2' }, ['small','medium','large','xlarge'].map(sz => {
                    const btn = h('button', {
                        class: 'btn ' + (state.get('fontSize') === sz ? 'btn-primary' : ''),
                        onClick: () => theme.applyFontSize(sz)
                    }, sz);
                    return btn;
                }))
            ]));
            return wrap;
        }

        function renderApps() {
            const wrap = h('div', { class: 'flex flex-col gap-4' });
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Startup apps'),
                h('div', { class: 'text-sm text-secondary' }, 'Apps that open automatically when you sign in.')
            ]));
            const startupWrap = h('div', { class: 'flex flex-col gap-2' });
            for (const app of reg.listInstalled()) {
                const isStartup = (state.get('startupApps') || []).includes(app.id);
                const row = h('div', { class: 'settings-row' }, [
                    h('span', { html: icon(app.icon), style: { width: '20px', height: '20px', color: 'var(--accent)' } }),
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, app.name),
                        h('div', { class: 'text-xs text-secondary' }, app.description || app.category)
                    ]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: isStartup ? 'checked' : null, onChange: (e) => {
                            const cur = state.get('startupApps') || [];
                            if (e.target.checked) state.set('startupApps', [...cur, app.id]);
                            else state.set('startupApps', cur.filter(id => id !== app.id));
                        }}),
                        h('span', { class: 'switch-slider' })
                    ])
                ]);
                startupWrap.appendChild(row);
            }
            wrap.appendChild(startupWrap);

            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Pinned taskbar apps'),
                h('div', { class: 'text-sm text-secondary' }, 'Choose which apps appear on the taskbar.')
            ]));
            const pinnedWrap = h('div', { class: 'flex flex-col gap-2' });
            for (const app of reg.listInstalled()) {
                const isPinned = (state.get('pinnedApps') || []).includes(app.id);
                const row = h('div', { class: 'settings-row' }, [
                    h('span', { html: icon(app.icon), style: { width: '20px', height: '20px', color: 'var(--accent)' } }),
                    h('div', { class: 'flex-1' }, [h('div', { class: 'font-bold text-sm' }, app.name)]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: isPinned ? 'checked' : null, onChange: (e) => {
                            const cur = state.get('pinnedApps') || [];
                            if (e.target.checked) state.set('pinnedApps', [...cur, app.id]);
                            else state.set('pinnedApps', cur.filter(id => id !== app.id));
                            bus.emit('taskbar:refresh');
                        }}),
                        h('span', { class: 'switch-slider' })
                    ])
                ]);
                pinnedWrap.appendChild(row);
            }
            wrap.appendChild(pinnedWrap);
            return wrap;
        }

        function renderSystem() {
            const wrap = h('div', { class: 'flex flex-col gap-4' });
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Taskbar'),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Position'),
                        h('div', { class: 'text-xs text-secondary' }, 'Where the taskbar appears on screen')
                    ]),
                    h('select', { class: 'select', style: { width: 'auto' }, onChange: (e) => { state.set('taskbarPosition', e.target.value); applyTaskbarSettings(); } }, [
                        h('option', { value: 'bottom', selected: state.get('taskbarPosition') === 'bottom' ? 'selected' : null }, 'Bottom'),
                        h('option', { value: 'top', selected: state.get('taskbarPosition') === 'top' ? 'selected' : null }, 'Top'),
                        h('option', { value: 'left', selected: state.get('taskbarPosition') === 'left' ? 'selected' : null }, 'Left'),
                        h('option', { value: 'right', selected: state.get('taskbarPosition') === 'right' ? 'selected' : null }, 'Right')
                    ])
                ]),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Auto-hide taskbar'),
                        h('div', { class: 'text-xs text-secondary' }, 'Hide taskbar until hovered')
                    ]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: state.get('taskbarAutoHide') ? 'checked' : null, onChange: (e) => { state.set('taskbarAutoHide', e.target.checked); applyTaskbarSettings(); } }),
                        h('span', { class: 'switch-slider' })
                    ])
                ])
            ]));
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Display'),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Reduce motion'),
                        h('div', { class: 'text-xs text-secondary' }, 'Disable animations and transitions')
                    ]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: state.get('reduceMotion') ? 'checked' : null, onChange: (e) => {
                            state.set('reduceMotion', e.target.checked);
                            document.body.classList.toggle('reduce-motion', e.target.checked);
                        }}),
                        h('span', { class: 'switch-slider' })
                    ])
                ]),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Performance mode'),
                        h('div', { class: 'text-xs text-secondary' }, 'Affects animation intensity and effects')
                    ]),
                    h('select', { class: 'select', style: { width: 'auto' }, onChange: (e) => state.set('performance', e.target.value) }, [
                        h('option', { value: 'auto', selected: state.get('performance') === 'auto' ? 'selected' : null }, 'Auto'),
                        h('option', { value: 'high', selected: state.get('performance') === 'high' ? 'selected' : null }, 'High'),
                        h('option', { value: 'low', selected: state.get('performance') === 'low' ? 'selected' : null }, 'Battery saver')
                    ])
                ])
            ]));
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Notifications'),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [h('div', { class: 'font-bold text-sm' }, 'Enable notifications')]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: state.get('notificationsEnabled') ? 'checked' : null, onChange: (e) => state.set('notificationsEnabled', e.target.checked) }),
                        h('span', { class: 'switch-slider' })
                    ])
                ]),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Do not disturb'),
                        h('div', { class: 'text-xs text-secondary' }, 'Silence notifications when active')
                    ]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: state.get('doNotDisturb') ? 'checked' : null, onChange: (e) => state.set('doNotDisturb', e.target.checked) }),
                        h('span', { class: 'switch-slider' })
                    ])
                ])
            ]));
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Sound'),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [h('div', { class: 'font-bold text-sm' }, 'System sounds')]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: state.get('soundEnabled') ? 'checked' : null, onChange: (e) => state.set('soundEnabled', e.target.checked) }),
                        h('span', { class: 'switch-slider' })
                    ])
                ])
            ]));
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Language'),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Display language'),
                        h('div', { class: 'text-xs text-secondary' }, 'Currently limited to UI labels')
                    ]),
                    h('select', { class: 'select', style: { width: 'auto' }, onChange: (e) => state.set('language', e.target.value) }, [
                        h('option', { value: 'en', selected: state.get('language') === 'en' ? 'selected' : null }, 'English'),
                        h('option', { value: 'es', selected: state.get('language') === 'es' ? 'selected' : null }, 'Español'),
                        h('option', { value: 'fr', selected: state.get('language') === 'fr' ? 'selected' : null }, 'Français'),
                        h('option', { value: 'de', selected: state.get('language') === 'de' ? 'selected' : null }, 'Deutsch'),
                        h('option', { value: 'zh', selected: state.get('language') === 'zh' ? 'selected' : null }, '中文'),
                        h('option', { value: 'ja', selected: state.get('language') === 'ja' ? 'selected' : null }, '日本語')
                    ])
                ])
            ]));
            return wrap;
        }

        function renderAccounts() {
            const wrap = h('div', { class: 'flex flex-col gap-4' });
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'User profile'),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex items-center gap-3 flex-1' }, [
                        h('div', { class: 'start-menu-user-avatar', style: { width: '40px', height: '40px', fontSize: '16px' } }, (state.get('username') || 'U').charAt(0).toUpperCase()),
                        h('div', {}, [
                            h('div', { class: 'font-bold' }, state.get('username') || 'User'),
                            h('div', { class: 'text-xs text-secondary' }, 'Local account')
                        ])
                    ])
                ]),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [h('div', { class: 'font-bold text-sm' }, 'Username')]),
                    h('input', { class: 'input', type: 'text', style: { width: '200px' }, value: state.get('username') || '', onChange: (e) => state.set('username', e.target.value) })
                ])
            ]));
            return wrap;
        }

        function renderPrivacy() {
            const wrap = h('div', { class: 'flex flex-col gap-4' });
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { class: 'settings-group-title' }, 'Privacy'),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Send anonymous usage data'),
                        h('div', { class: 'text-xs text-secondary' }, 'Help improve AwokeOS (data stays in your browser)')
                    ]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: state.get('analytics') ? 'checked' : null, onChange: (e) => state.set('analytics', e.target.checked) }),
                        h('span', { class: 'switch-slider' })
                    ])
                ]),
                h('div', { class: 'settings-row' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold text-sm' }, 'Lock screen'),
                        h('div', { class: 'text-xs text-secondary' }, 'Show lock screen on startup')
                    ]),
                    h('label', { class: 'switch' }, [
                        h('input', { type: 'checkbox', checked: state.get('locked') ? 'checked' : null, onChange: (e) => state.set('locked', e.target.checked) }),
                        h('span', { class: 'switch-slider' })
                    ])
                ])
            ]));
            return wrap;
        }

        function renderStorage() {
            const wrap = h('div', { class: 'flex flex-col gap-4' });
            const refresh = () => {
                wrap.innerHTML = '';
                getVFS().getStats().then(stats => {
                    wrap.appendChild(h('div', { class: 'settings-group' }, [
                        h('div', { class: 'settings-group-title' }, 'Storage'),
                        h('div', { class: 'settings-row' }, [
                            h('div', { class: 'flex-1' }, [
                                h('div', { class: 'font-bold text-sm' }, 'AwokeOS files'),
                                h('div', { class: 'text-xs text-secondary' }, `${stats.files} files, ${stats.folders} folders · ${formatSize(stats.totalSize)}`)
                            ])
                        ]),
                        h('div', { class: 'progress', style: { marginTop: '8px' } }, [
                            h('div', { class: 'progress-bar', style: { width: Math.min(100, (stats.storageUsed / Math.max(1, stats.storageQuota)) * 100) + '%' } })
                        ]),
                        h('div', { class: 'text-xs text-secondary mt-2' }, stats.storageQuota ? `${formatSize(stats.storageUsed)} of ${formatSize(stats.storageQuota)} used` : 'Storage info unavailable'),
                        h('button', {
                            class: 'btn btn-danger mt-2',
                            onClick: async () => {
                                if (!confirm('Erase all AwokeOS files? This cannot be undone.')) return;
                                await getVFS().clear();
                                bus.emit(EVENTS.TOAST, { type: 'success', message: 'Storage cleared' });
                                refresh();
                            }
                        }, 'Erase all data')
                    ]));
                });
            };
            refresh();
            return wrap;
        }

        function renderAbout() {
            const wrap = h('div', { class: 'flex flex-col gap-4' });
            wrap.appendChild(h('div', { class: 'settings-group' }, [
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' } }, [
                    h('div', { html: icon('app'), style: { width: '64px', height: '64px', color: 'var(--accent)' } }),
                    h('div', {}, [
                        h('div', { class: 'font-bold text-lg' }, 'AwokeOS'),
                        h('div', { class: 'text-sm text-secondary' }, 'Version 1.0.0')
                    ])
                ]),
                h('div', { class: 'settings-row' }, [h('div', { class: 'flex-1' }, [h('div', { class: 'font-bold text-sm' }, 'Platform')]), h('div', { class: 'text-sm' }, navigator.platform || 'Web')]),
                h('div', { class: 'settings-row' }, [h('div', { class: 'flex-1' }, [h('div', { class: 'font-bold text-sm' }, 'User Agent')]), h('div', { class: 'text-sm' }, navigator.userAgent.split(' ').slice(-2)[0])]),
                h('div', { class: 'settings-row' }, [h('div', { class: 'flex-1' }, [h('div', { class: 'font-bold text-sm' }, 'Language')]), h('div', { class: 'text-sm' }, navigator.language)]),
                h('div', { class: 'settings-row' }, [h('div', { class: 'flex-1' }, [h('div', { class: 'font-bold text-sm' }, 'Storage API')]), h('div', { class: 'text-sm' }, navigator.storage ? 'Available' : 'Limited')])
            ]));
            return wrap;
        }

        // Show initial section
        const initial = args?.tab || 'personalization';
        showSection(sections.find(s => s.id === initial) || sections[0]);
        return root;
    }
};

function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B','KB','MB','GB','TB'];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * App Store — showcase of installed apps, themes, and wallpapers.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { getAppRegistry } from '../../core/app-registry.js';
import { getThemeService, THEMES, ACCENTS } from '../../services/theme-service.js';
import { WALLPAPERS } from '../../assets/wallpapers.js';
import { bus, EVENTS } from '../../core/event-bus.js';
import { getState } from '../../core/state-manager.js';

export default {
    id: 'app-store',
    name: 'App Store',
    icon: 'store',
    category: 'System',
    description: 'Discover and customize apps',
    defaultSize: { width: 880, height: 600 },
    minSize: { width: 500, height: 360 },
    singleton: true,

    async render() {
        const root = h('div', { class: 'app-root store-root' });
        const reg = getAppRegistry();
        const theme = getThemeService();
        const state = getState();

        // Featured / hero
        const hero = h('div', { class: 'store-hero' }, [
            h('div', {}, [
                h('div', { class: 'store-hero-title' }, 'Welcome to AwokeOS'),
                h('div', { class: 'store-hero-sub' }, 'A modern, browser-based operating system.')
            ])
        ]);

        // Apps section
        const appsSection = h('div', { class: 'store-section' }, [
            h('div', { class: 'store-section-title' }, 'Installed Apps'),
            h('div', { class: 'store-grid' },
                reg.listInstalled().map(app => h('button', {
                    class: 'store-card',
                    onClick: () => bus.emit(EVENTS.APP_OPENED, { id: app.id })
                }, [
                    h('div', { class: 'store-card-icon', html: icon(app.icon) }),
                    h('div', { class: 'store-card-name' }, app.name),
                    h('div', { class: 'store-card-desc' }, app.description || app.category)
                ]))
            )
        ]);

        // Themes section
        const themesSection = h('div', { class: 'store-section' }, [
            h('div', { class: 'store-section-title' }, 'Themes'),
            h('div', { class: 'store-grid' },
                theme.themes.map(t => h('button', {
                    class: 'store-card',
                    onClick: () => theme.applyTheme(t.id)
                }, [
                    h('div', {
                        class: 'store-card-preview',
                        style: {
                            background: previewBg(t.id),
                            border: state.get('theme') === t.id ? '2px solid var(--accent)' : ''
                        }
                    }, h('span', {}, t.icon)),
                    h('div', { class: 'store-card-name' }, t.name)
                ]))
            )
        ]);

        // Accents
        const accentsSection = h('div', { class: 'store-section' }, [
            h('div', { class: 'store-section-title' }, 'Accent Colors'),
            h('div', { class: 'store-grid' },
                theme.accents.map(a => h('button', {
                    class: 'store-card',
                    onClick: () => theme.applyAccent(a.id)
                }, [
                    h('div', {
                        class: 'store-card-preview',
                        style: { background: a.color, borderRadius: '50%', width: '40px', height: '40px', margin: '0 auto', border: state.get('accent') === a.id ? '3px solid var(--text-color)' : '' }
                    }),
                    h('div', { class: 'store-card-name' }, a.name)
                ]))
            )
        ]);

        // Wallpapers
        const wallpapersSection = h('div', { class: 'store-section' }, [
            h('div', { class: 'store-section-title' }, 'Wallpapers'),
            h('div', { class: 'store-grid' },
                WALLPAPERS.map(w => h('button', {
                    class: 'store-card',
                    onClick: () => { state.set('wallpaper', w.id); bus.emit(EVENTS.WALLPAPER_CHANGED, w.id); }
                }, [
                    h('div', {
                        class: 'store-card-preview',
                        style: {
                            background: w.preview,
                            border: state.get('wallpaper') === w.id ? '2px solid var(--accent)' : ''
                        }
                    }),
                    h('div', { class: 'store-card-name' }, w.name)
                ]))
            )
        ]);

        const scroller = h('div', { class: 'store-scroll scroll-y' }, [hero, appsSection, themesSection, accentsSection, wallpapersSection]);
        root.appendChild(scroller);
        return root;
    }
};

function previewBg(id) {
    const map = {
        'dark': 'linear-gradient(135deg, #0a0a0f, #1c1c24)',
        'light': 'linear-gradient(135deg, #f5f5f7, #ffffff)',
        'amoled': 'linear-gradient(135deg, #000, #0a0a0a)',
        'glassmorphism': 'linear-gradient(135deg, #667eea, #764ba2)',
        'windows': 'linear-gradient(135deg, #0078d4, #005a9e)',
        'macos': 'linear-gradient(135deg, #6d28d9, #be185d)',
        'linux': 'linear-gradient(135deg, #1d1d20, #2d2d30)'
    };
    return map[id] || 'var(--bg-input)';
}

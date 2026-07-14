/**
 * Theme manager UI — exposed via Settings; here we just provide
 * high-level helpers and a custom theme editor.
 */

import { getState } from '../core/state-manager.js';
import { getThemeService, THEMES, ACCENTS } from '../services/theme-service.js';
import { bus, EVENTS } from '../core/event-bus.js';
import { h } from '../utils/dom.js';

/**
 * Render a theme card for the Settings UI.
 */
export function renderThemePicker(currentTheme, onPick) {
    const themeSvc = getThemeService();
    return h('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }
    }, themeSvc.themes.map(t => h('button', {
        class: 'btn',
        style: { padding: '12px', flexDirection: 'column', gap: '8px', height: 'auto' },
        onClick: () => onPick(t.id)
    }, [
        h('div', { style: { width: '100%', height: '60px', borderRadius: '6px', background: getThemePreviewBg(t.id), border: `2px solid ${currentTheme === t.id ? 'var(--accent)' : 'transparent'}` } }),
        h('div', { style: { fontSize: '12px', fontWeight: '500' } }, [t.icon + ' ', t.name])
    ])));
}

function getThemePreviewBg(id) {
    switch (id) {
        case 'dark': return 'linear-gradient(135deg, #0a0a0f, #1c1c24)';
        case 'light': return 'linear-gradient(135deg, #f5f5f7, #ffffff)';
        case 'amoled': return 'linear-gradient(135deg, #000, #0a0a0a)';
        case 'glassmorphism': return 'linear-gradient(135deg, #667eea, #764ba2)';
        case 'windows': return 'linear-gradient(135deg, #0078d4, #005a9e)';
        case 'macos': return 'linear-gradient(135deg, #6d28d9, #be185d)';
        case 'linux': return 'linear-gradient(135deg, #1d1d20, #2d2d30)';
        default: return 'var(--bg-input)';
    }
}

/**
 * Render an accent color swatch row.
 */
export function renderAccentPicker(currentAccent, onPick) {
    return h('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '8px' }
    }, ACCENTS.map(a => h('button', {
        title: a.name,
        style: {
            width: '40px', height: '40px', borderRadius: '50%',
            background: a.color,
            border: currentAccent === a.id ? '3px solid var(--text-color)' : '2px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            transition: 'transform 120ms',
            margin: '0 auto'
        },
        onClick: () => onPick(a.id),
        onMouseenter: (e) => e.currentTarget.style.transform = 'scale(1.1)',
        onMouseleave: (e) => e.currentTarget.style.transform = 'scale(1)'
    })));
}

/**
 * Render wallpaper picker.
 */
export function renderWallpaperPicker(currentWallpaper, onPick, wallpapers) {
    return h('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }
    }, wallpapers.map(w => h('button', {
        class: 'btn',
        style: { padding: '8px', flexDirection: 'column', gap: '6px', height: 'auto' },
        onClick: () => onPick(w.id)
    }, [
        h('div', { style: { width: '100%', height: '90px', borderRadius: '6px', background: w.preview, border: `2px solid ${currentWallpaper === w.id ? 'var(--accent)' : 'transparent'}` } }),
        h('div', { style: { fontSize: '12px' } }, w.name)
    ])));
}

/**
 * Listen for theme:set events (from quick settings)
 */
bus.on('theme:set', (id) => getThemeService().applyTheme(id));
bus.on('accent:set', (id) => getThemeService().applyAccent(id));
bus.on('wallpaper:set', (id) => {
    getState().set('wallpaper', id);
    bus.emit(EVENTS.WALLPAPER_CHANGED, id);
});

export { THEMES, ACCENTS };

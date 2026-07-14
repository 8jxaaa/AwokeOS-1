/**
 * Theme service — applies and persists the active theme + accent.
 * Themes are CSS variables defined in /themes/themes.css.
 *
 * Built-in themes: light, dark, amoled, glassmorphism, windows, macos, linux.
 * Custom themes can be defined by user (see Settings).
 */

import { getState } from '../core/state-manager.js';
import { bus, EVENTS } from '../core/event-bus.js';
import { settings } from './persistence-service.js';

const THEMES = [
    { id: 'dark', name: 'Dark', icon: 'moon-filled' },
    { id: 'light', name: 'Light', icon: 'sun' },
    { id: 'amoled', name: 'AMOLED', icon: 'chip' },
    { id: 'glassmorphism', name: 'Glass', icon: 'diamond' },
    { id: 'windows', name: 'Windows', icon: 'app' },
    { id: 'macos', name: 'macOS', icon: 'apple' },
    { id: 'linux', name: 'Linux', icon: 'linux-penguin' }
];

const ACCENTS = [
    { id: 'indigo', name: 'Indigo', color: '#6366f1' },
    { id: 'blue', name: 'Blue', color: '#3b82f6' },
    { id: 'cyan', name: 'Cyan', color: '#06b6d4' },
    { id: 'teal', name: 'Teal', color: '#14b8a6' },
    { id: 'green', name: 'Green', color: '#22c55e' },
    { id: 'lime', name: 'Lime', color: '#84cc16' },
    { id: 'yellow', name: 'Yellow', color: '#eab308' },
    { id: 'orange', name: 'Orange', color: '#f97316' },
    { id: 'red', name: 'Red', color: '#ef4444' },
    { id: 'pink', name: 'Pink', color: '#ec4899' },
    { id: 'purple', name: 'Purple', color: '#a855f7' },
    { id: 'slate', name: 'Slate', color: '#64748b' }
];

class ThemeService {
    constructor() {
        this.themes = THEMES;
        this.accents = ACCENTS;
        this.customThemes = this._loadCustomThemes();
    }

    _loadCustomThemes() {
        return settings.get('custom-themes', []);
    }

    applyTheme(themeId) {
        const id = this.themes.find(t => t.id === themeId) ? themeId : 'dark';
        document.body.setAttribute('data-theme', id);
        getState().set('theme', id);
        bus.emit(EVENTS.THEME_CHANGED, id);
    }

    applyAccent(accentId) {
        const a = this.accents.find(x => x.id === accentId) ? accentId : 'indigo';
        document.body.setAttribute('data-accent', a);
        getState().set('accent', a);
        bus.emit(EVENTS.ACCENT_CHANGED, a);
    }

    applyFontSize(size) {
        const valid = ['small', 'medium', 'large', 'xlarge'].includes(size) ? size : 'medium';
        document.body.setAttribute('data-font-size', valid);
        getState().set('fontSize', valid);
    }

    applyAll() {
        const state = getState();
        this.applyTheme(state.get('theme'));
        this.applyAccent(state.get('accent'));
        this.applyFontSize(state.get('fontSize'));
        this.applyVisualSettings();
    }

    applyVisualSettings() {
        const state = getState();
        const speed = state.get('animationSpeed') || 'normal';
        const trans = state.get('transparency') ?? 0.78;
        const blur = state.get('blurStrength') ?? 24;
        const durMap = { slow: { fast: 180, med: 320, slow: 500 }, normal: { fast: 80, med: 160, slow: 260 }, fast: { fast: 50, med: 100, slow: 180 }, instant: { fast: 0, med: 0, slow: 0 } };
        const d = durMap[speed] || durMap.normal;
        document.documentElement.style.setProperty('--dur-fast', d.fast + 'ms');
        document.documentElement.style.setProperty('--dur-med', d.med + 'ms');
        document.documentElement.style.setProperty('--dur-slow', d.slow + 'ms');
        document.documentElement.style.setProperty('--bg-elevated', `rgba(28, 28, 36, ${trans})`);
        document.documentElement.style.setProperty('--blur-strength', blur + 'px');
        document.documentElement.style.setProperty('--window-blur', (blur + 4) + 'px');
    }

    /**
     * Add a custom theme (user-defined) — applies CSS variables.
     */
    addCustomTheme(theme) {
        this.customThemes.push(theme);
        settings.set('custom-themes', this.customThemes);
        this._injectCustomTheme(theme);
    }
    removeCustomTheme(id) {
        this.customThemes = this.customThemes.filter(t => t.id !== id);
        settings.set('custom-themes', this.customThemes);
        document.getElementById(`custom-theme-${id}`)?.remove();
    }

    _injectCustomTheme(theme) {
        const existing = document.getElementById(`custom-theme-${theme.id}`);
        if (existing) existing.remove();
        const css = `:root, [data-theme="${theme.id}"] { ${theme.variables} }`;
        const el = document.createElement('style');
        el.id = `custom-theme-${theme.id}`;
        el.textContent = css;
        document.head.appendChild(el);
    }

    injectAllCustom() {
        for (const t of this.customThemes) this._injectCustomTheme(t);
    }
}

let _instance = null;
export function getThemeService() {
    if (!_instance) _instance = new ThemeService();
    return _instance;
}

export { THEMES, ACCENTS };

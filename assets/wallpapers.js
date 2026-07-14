/**
 * Built-in wallpapers — pure CSS gradients (no external assets needed).
 * Each wallpaper is a CSS background string applied to the wallpaper element.
 */

export const WALLPAPERS = [
    {
        id: 'aurora',
        name: 'Aurora',
        css: 'linear-gradient(135deg, #0f2027 0%, #203a43 40%, #2c5364 100%), radial-gradient(ellipse at 20% 30%, rgba(99,102,241,.35), transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(168,85,247,.35), transparent 60%)',
        blend: false,
        preview: 'linear-gradient(135deg, #0f2027, #2c5364)'
    },
    {
        id: 'sunset',
        name: 'Sunset',
        css: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
        preview: 'linear-gradient(135deg, #ff6e7f, #bfe9ff)'
    },
    {
        id: 'ocean',
        name: 'Ocean',
        css: 'linear-gradient(135deg, #2E3192 0%, #1BFFFF 100%)',
        preview: 'linear-gradient(135deg, #2E3192, #1BFFFF)'
    },
    {
        id: 'forest',
        name: 'Forest',
        css: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)',
        preview: 'linear-gradient(135deg, #134E5E, #71B280)'
    },
    {
        id: 'midnight',
        name: 'Midnight',
        css: 'linear-gradient(135deg, #0F0C29 0%, #302B63 50%, #24243E 100%)',
        preview: 'linear-gradient(135deg, #0F0C29, #24243E)'
    },
    {
        id: 'candy',
        name: 'Candy',
        css: 'linear-gradient(135deg, #D8B4FE 0%, #FBCFE8 50%, #FECACA 100%)',
        preview: 'linear-gradient(135deg, #D8B4FE, #FECACA)'
    },
    {
        id: 'fire',
        name: 'Ember',
        css: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
        preview: 'linear-gradient(135deg, #f12711, #f5af19)'
    },
    {
        id: 'nebula',
        name: 'Nebula',
        css: 'radial-gradient(ellipse at 30% 40%, #ff6ec4 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, #7873f5 0%, transparent 50%), linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        preview: 'radial-gradient(ellipse at 30% 40%, #ff6ec4, transparent), radial-gradient(ellipse at 70% 60%, #7873f5, transparent), #0a0a0f'
    },
    {
        id: 'monochrome',
        name: 'Mono',
        css: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
        preview: 'linear-gradient(135deg, #232526, #414345)'
    },
    {
        id: 'mesh-blue',
        name: 'Mesh Blue',
        css: 'radial-gradient(at 0% 0%, #3b82f6 0%, transparent 50%), radial-gradient(at 100% 100%, #06b6d4 0%, transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        preview: 'radial-gradient(at 0% 0%, #3b82f6, transparent), radial-gradient(at 100% 100%, #06b6d4, transparent), #0f172a'
    },
    {
        id: 'mesh-purple',
        name: 'Mesh Purple',
        css: 'radial-gradient(at 20% 30%, #a855f7 0%, transparent 50%), radial-gradient(at 80% 70%, #ec4899 0%, transparent 50%), linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        preview: 'radial-gradient(at 20% 30%, #a855f7, transparent), radial-gradient(at 80% 70%, #ec4899, transparent), #0a0a0f'
    },
    {
        id: 'mesh-green',
        name: 'Mesh Green',
        css: 'radial-gradient(at 30% 30%, #22c55e 0%, transparent 50%), radial-gradient(at 70% 70%, #14b8a6 0%, transparent 50%), linear-gradient(135deg, #0a0a0f 0%, #052e16 100%)',
        preview: 'radial-gradient(at 30% 30%, #22c55e, transparent), radial-gradient(at 70% 70%, #14b8a6, transparent), #0a0a0f'
    }
];

/**
 * Apply wallpaper to element.
 */
export function applyWallpaper(el, wpId) {
    const wp = WALLPAPERS.find(w => w.id === wpId) || WALLPAPERS[0];
    el.style.background = wp.css;
    el.style.backgroundSize = 'cover';
    el.style.backgroundAttachment = 'fixed';
}

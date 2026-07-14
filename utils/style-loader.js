/**
 * Style loader — dynamically loads CSS files and ensures they are only loaded once.
 * Used by apps to load their per-app stylesheets.
 */

const loaded = new Set();

/**
 * Load a CSS file by URL and inject into <head>.
 * Returns a promise that resolves when the stylesheet is loaded.
 */
export function loadStyle(href) {
    if (loaded.has(href)) return Promise.resolve();
    loaded.add(href);
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve(link);
        link.onerror = (e) => {
            loaded.delete(href);
            reject(e);
        };
        document.head.appendChild(link);
    });
}

/**
 * Inject inline CSS into a scoped <style> tag.
 */
export function injectStyle(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
}

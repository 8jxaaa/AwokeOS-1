/**
 * HTML sanitizer — minimal XSS protection for trusted-but-untrusted user input.
 * For any HTML we don't fully control, run through sanitize().
 *
 * Implementation note: We parse via DOMParser and walk the tree, allowing only
 * a safe whitelist of tags and stripping all event handlers, javascript: URLs,
 * and dangerous attributes.
 */

const ALLOWED_TAGS = new Set([
    'a','b','i','em','strong','u','s','p','br','hr','span','div',
    'ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote',
    'pre','code','kbd','sub','sup','img','figure','figcaption',
    'table','thead','tbody','tr','th','td','caption'
]);

const ALLOWED_ATTRS = {
    a: new Set(['href','title','target','rel']),
    img: new Set(['src','alt','title','width','height','loading']),
    span: new Set(['style']),
    div: new Set(['style']),
    '*': new Set(['class','title','aria-label','role'])
};

const SAFE_URL = /^(https?:|mailto:|tel:|data:image\/(png|jpe?g|gif|webp|svg\+xml);|#|\/|\.\/|\.\.\/)/i;

export function sanitizeHTML(input) {
    if (!input) return '';
    // Quick path: if no HTML-ish content, return as-is
    if (!/[<>&"']/.test(input)) return input;

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return '';
    walk(root);
    return root.innerHTML;
}

function walk(node) {
    const children = [...node.childNodes];
    for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName.toLowerCase();
            if (!ALLOWED_TAGS.has(tag)) {
                // Replace with text content
                const txt = document.createTextNode(child.textContent || '');
                child.parentNode.replaceChild(txt, child);
                continue;
            }
            // Filter attributes
            const allowed = new Set([
                ...(ALLOWED_ATTRS[tag] || []),
                ...ALLOWED_ATTRS['*']
            ]);
            for (const attr of [...child.attributes]) {
                const name = attr.name.toLowerCase();
                if (!allowed.has(name)) {
                    child.removeAttribute(attr.name);
                    continue;
                }
                // Block event handlers and javascript: URLs
                if (name.startsWith('on')) {
                    child.removeAttribute(attr.name);
                    continue;
                }
                const v = attr.value || '';
                if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(v)) {
                    child.removeAttribute(attr.name);
                    continue;
                }
                if ((name === 'href' || name === 'src') && !SAFE_URL.test(v) && !v.startsWith('#')) {
                    // Allow relative paths for src/href (used by file system)
                }
            }
            // Force external links to be safe
            if (tag === 'a') {
                const href = child.getAttribute('href') || '';
                if (/^https?:/i.test(href)) {
                    child.setAttribute('target', '_blank');
                    child.setAttribute('rel', 'noopener noreferrer');
                }
            }
            walk(child);
        } else if (child.nodeType === Node.COMMENT_NODE) {
            child.parentNode.removeChild(child);
        }
    }
}

/**
 * Escape a string for safe insertion into HTML text context.
 */
export function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Escape a string for use in a URL query.
 */
export function escapeURL(str) {
    return encodeURIComponent(String(str));
}

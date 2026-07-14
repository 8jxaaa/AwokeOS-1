/**
 * Snap layout — detects snap regions during window drag.
 * Returns the snap zone (or null) and updates a preview overlay.
 */

export const SNAP_REGIONS = {
    LEFT: 'left',
    RIGHT: 'right',
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    TOP: 'top',
    MAXIMIZE: 'maximize' // touches top edge
};

export const SNAP_THRESHOLD = 8; // px from edge

/**
 * Given pointer position relative to viewport, determine snap zone.
 */
export function detectSnap(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const t = SNAP_THRESHOLD;
    const corner = 80;

    // Corners first (more specific)
    if (x < t && y < corner) return SNAP_REGIONS.TOP_LEFT;
    if (x > w - t && y < corner) return SNAP_REGIONS.TOP_RIGHT;

    // Edges
    if (x < t) return SNAP_REGIONS.LEFT;
    if (x > w - t) return SNAP_REGIONS.RIGHT;
    if (y < t) return SNAP_REGIONS.TOP;

    return null;
}

/**
 * Get the bounding rect of a snap zone (relative to viewport).
 */
export function snapBounds(zone) {
    const w = window.innerWidth;
    const h = window.innerHeight - getTaskbarHeight(); // exclude taskbar
    switch (zone) {
        case SNAP_REGIONS.LEFT: return { x: 0, y: 0, width: w / 2, height: h };
        case SNAP_REGIONS.RIGHT: return { x: w / 2, y: 0, width: w / 2, height: h };
        case SNAP_REGIONS.TOP_LEFT: return { x: 0, y: 0, width: w / 2, height: h / 2 };
        case SNAP_REGIONS.TOP_RIGHT: return { x: w / 2, y: 0, width: w / 2, height: h / 2 };
        case SNAP_REGIONS.TOP:
        case SNAP_REGIONS.MAXIMIZE: return { x: 0, y: 0, width: w, height: h };
        default: return null;
    }
}

function getTaskbarHeight() {
    const tb = document.getElementById('taskbar');
    return tb ? tb.offsetHeight : 52;
}

/**
 * Show or hide the snap preview overlay.
 */
let previewEl = null;
export function showSnapPreview(zone) {
    if (!zone) {
        hideSnapPreview();
        return;
    }
    const bounds = snapBounds(zone);
    if (!bounds) return;
    if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.className = 'snap-preview';
        document.body.appendChild(previewEl);
    }
    Object.assign(previewEl.style, {
        left: bounds.x + 'px',
        top: bounds.y + 'px',
        width: bounds.width + 'px',
        height: bounds.height + 'px',
        display: 'block'
    });
}
export function hideSnapPreview() {
    if (previewEl) previewEl.style.display = 'none';
}

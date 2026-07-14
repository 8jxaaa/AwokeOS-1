/**
 * Image Viewer — display images from the VFS.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { getVFS } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';

export default {
    id: 'image-viewer',
    name: 'Image Viewer',
    icon: 'image',
    category: 'Media',
    description: 'View images',
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 320, height: 240 },

    async render({ args }) {
        const root = h('div', { class: 'app-root iv-root' });

        let currentPath = args?.path || null;
        let scale = 1;
        let rotation = 0;
        let panX = 0, panY = 0;

        // Toolbar
        const pathLabel = h('div', { class: 'iv-path' }, currentPath ? basename(currentPath) : 'No image');
        const toolbar = h('div', { class: 'app-toolbar' }, [
            h('button', { class: 'btn-icon', title: 'Zoom out', html: icon('minus'), onClick: () => setScale(scale * 0.8) }),
            h('button', { class: 'btn-icon', title: 'Reset', onClick: reset, html: icon('refresh') }),
            h('button', { class: 'btn-icon', title: 'Zoom in', html: icon('plus'), onClick: () => setScale(scale * 1.25) }),
            h('button', { class: 'btn-icon', title: 'Rotate', html: icon('refresh'), onClick: () => { rotation = (rotation + 90) % 360; applyTransform(); } }),
            h('button', { class: 'btn-icon', title: 'Previous', html: icon('arrow-left'), onClick: prev }),
            h('button', { class: 'btn-icon', title: 'Next', html: icon('arrow-right'), onClick: next }),
            h('div', { class: 'flex-1' }),
            h('button', { class: 'btn-icon', title: 'Open', html: icon('folder-open'), onClick: openFile }),
            h('button', { class: 'btn-icon', title: 'Download', html: icon('download'), onClick: download }),
            pathLabel
        ]);

        // Image container
        const container = h('div', { class: 'iv-canvas' });
        const img = h('img', { class: 'iv-image', draggable: 'true' });
        container.appendChild(img);
        const placeholder = h('div', { class: 'iv-placeholder' }, [
            h('div', { html: icon('image'), style: { width: '64px', height: '64px', opacity: '0.3' } }),
            h('div', {}, 'Open an image to view'),
            h('button', { class: 'btn btn-primary mt-2', onClick: openFile }, 'Open image')
        ]);
        container.appendChild(placeholder);

        // Status
        const status = h('div', { class: 'app-statusbar' }, 'Ready');

        root.appendChild(toolbar);
        root.appendChild(container);
        root.appendChild(status);

        function applyTransform() {
            img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale}) rotate(${rotation}deg)`;
            status.textContent = `${Math.round(scale * 100)}% · ${rotation}°`;
        }

        function setScale(s) {
            scale = Math.max(0.1, Math.min(10, s));
            applyTransform();
        }
        function reset() {
            scale = 1; rotation = 0; panX = 0; panY = 0;
            applyTransform();
        }

        // Drag to pan
        let dragging = false, sx, sy, ox, oy;
        container.addEventListener('pointerdown', (e) => {
            dragging = true;
            sx = e.clientX; sy = e.clientY;
            ox = panX; oy = panY;
            container.setPointerCapture(e.pointerId);
        });
        container.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            panX = ox + (e.clientX - sx);
            panY = oy + (e.clientY - sy);
            applyTransform();
        });
        container.addEventListener('pointerup', () => dragging = false);

        // Wheel zoom
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            setScale(scale * (e.deltaY < 0 ? 1.1 : 0.9));
        }, { passive: false });

        // Keyboard
        const kbd = (e) => {
            if (!root.isConnected) return;
            if (e.key === '+' || e.key === '=') setScale(scale * 1.25);
            else if (e.key === '-') setScale(scale * 0.8);
            else if (e.key === '0') reset();
            else if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'ArrowRight') next();
        };
        document.addEventListener('keydown', kbd);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                document.removeEventListener('keydown', kbd);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        async function loadFile(path) {
            try {
                const vfs = getVFS();
                const entry = await vfs.readFile(path);
                const blob = entry.content instanceof Blob ? entry.content : new Blob([entry.content], { type: entry.mimeType });
                const url = URL.createObjectURL(blob);
                if (img.src) URL.revokeObjectURL(img.src);
                img.src = url;
                img.style.display = '';
                placeholder.style.display = 'none';
                currentPath = path;
                pathLabel.textContent = basename(path);
                reset();
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Failed: ' + err.message });
            }
        }

        async function prev() {
            await navigateSibling(-1);
        }
        async function next() {
            await navigateSibling(1);
        }
        async function navigateSibling(dir) {
            if (!currentPath) return;
            const vfs = getVFS();
            const parent = await vfs.list(dirname(currentPath));
            const images = parent.filter(e => e.type === 'file' && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(e.name));
            const idx = images.findIndex(e => e.path === currentPath);
            const newIdx = (idx + dir + images.length) % images.length;
            if (images[newIdx]) await loadFile(images[newIdx].path);
        }

        function openFile() {
            bus.emit(EVENTS.APP_OPENED, { id: 'file-explorer', args: { pickFile: true, filter: 'image', onPick: loadFile }});
        }

        async function download() {
            if (!currentPath) return;
            const vfs = getVFS();
            const blob = await vfs.exportFile(currentPath);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = basename(currentPath);
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        if (currentPath) await loadFile(currentPath);

        return root;
    }
};

function basename(p) { return p.split('/').pop(); }
function dirname(p) { return p.split('/').slice(0, -1).join('/') || '/'; }

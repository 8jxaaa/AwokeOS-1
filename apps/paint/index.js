/**
 * Paint — drawing app on a canvas.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { getVFS } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';

export default {
    id: 'paint',
    name: 'Paint',
    icon: 'pen-tool',
    category: 'Creativity',
    description: 'Draw and paint',
    defaultSize: { width: 900, height: 640 },
    minSize: { width: 400, height: 360 },

    async render() {
        const root = h('div', { class: 'app-root paint-root' });

        const canvas = h('canvas', { class: 'paint-canvas' });
        const ctx = canvas.getContext('2d');
        canvas.width = 1200;
        canvas.height = 800;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Tools
        let tool = 'pencil'; // pencil, brush, eraser, line, rect, ellipse, fill
        let color = '#000000';
        let size = 3;

        const colorPresets = ['#000000','#ffffff','#e81123','#ff8c00','#fff100','#16c60c','#0078d4','#a855f7','#ec4899','#8b4513'];

        const toolBtns = [
            { id: 'pencil', icon: 'edit-2', title: 'Pencil' },
            { id: 'brush', icon: 'pen-tool', title: 'Brush' },
            { id: 'eraser', icon: 'minus', title: 'Eraser' },
            { id: 'line', icon: 'minus', title: 'Line' },
            { id: 'rect', icon: 'app', title: 'Rectangle' },
            { id: 'ellipse', icon: 'circle', title: 'Ellipse' },
            { id: 'fill', icon: 'edit', title: 'Fill bucket' }
        ];

        const toolsEl = h('div', { class: 'paint-tools' }, toolBtns.map(t => h('button', {
            class: 'paint-tool ' + (tool === t.id ? 'active' : ''),
            title: t.title,
            html: icon(t.icon),
            onClick: () => { tool = t.id; for (const b of toolsEl.children) b.classList.remove('active'); }
        })));

        const colorPicker = h('input', { type: 'color', value: color, class: 'paint-color-picker', onInput: (e) => color = e.target.value });
        const sizeSlider = h('input', { type: 'range', min: '1', max: '50', value: size, class: 'paint-size', onInput: (e) => size = +e.target.value });
        const sizeLabel = h('span', { class: 'paint-size-label' }, size + 'px');

        const colorPresetsEl = h('div', { class: 'paint-presets' }, colorPresets.map(c => h('button', {
            class: 'paint-preset',
            style: { background: c },
            onClick: () => { color = c; colorPicker.value = c; }
        })));

        const undoBtn = h('button', { class: 'btn btn-sm', onClick: undo, html: '↶ Undo' });
        const redoBtn = h('button', { class: 'btn btn-sm', onClick: redo, html: '↷ Redo' });
        const clearBtn = h('button', { class: 'btn btn-sm btn-danger', onClick: clear, html: 'Clear' });
        const saveBtn = h('button', { class: 'btn btn-sm btn-primary', onClick: save, html: `${icon('save')} Save` });

        const toolbar = h('div', { class: 'paint-toolbar' }, [
            toolsEl,
            h('div', { class: 'paint-divider' }),
            colorPicker,
            colorPresetsEl,
            h('div', { class: 'paint-divider' }),
            sizeSlider, sizeLabel,
            h('div', { class: 'paint-divider' }),
            undoBtn, redoBtn, clearBtn, saveBtn
        ]);

        const canvasWrap = h('div', { class: 'paint-canvas-wrap' }, [canvas]);

        root.appendChild(toolbar);
        root.appendChild(canvasWrap);

        // State
        let drawing = false;
        let lastX = 0, lastY = 0;
        let startX = 0, startY = 0;
        let snapshot = null;
        const history = [];
        const historyLimit = 30;
        let historyIdx = -1;

        function pushHistory() {
            history.length = historyIdx + 1;
            history.push(canvas.toDataURL());
            if (history.length > historyLimit) history.shift();
            historyIdx = history.length - 1;
        }

        function restoreHistory() {
            if (historyIdx < 0) return;
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = history[historyIdx];
        }

        function undo() {
            if (historyIdx > 0) {
                historyIdx--;
                restoreHistory();
            }
        }
        function redo() {
            if (historyIdx < history.length - 1) {
                historyIdx++;
                restoreHistory();
            }
        }
        function clear() {
            if (!confirm('Clear canvas?')) return;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            pushHistory();
        }

        async function save() {
            const name = prompt('Save as (filename in /Pictures):', 'drawing.png');
            if (!name) return;
            const path = name.startsWith('/') ? name : '/Pictures/' + name;
            canvas.toBlob(async (blob) => {
                try {
                    await getVFS().writeFile(path, blob);
                    bus.emit(EVENTS.TOAST, { type: 'success', message: 'Saved to ' + path });
                } catch (err) {
                    bus.emit(EVENTS.TOAST, { type: 'error', message: 'Save failed: ' + err.message });
                }
            }, 'image/png');
        }

        sizeSlider.addEventListener('input', (e) => {
            size = +e.target.value;
            sizeLabel.textContent = size + 'px';
        });

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const cx = (e.touches?.[0]?.clientX ?? e.clientX);
            const cy = (e.touches?.[0]?.clientY ?? e.clientY);
            return {
                x: (cx - rect.left) * scaleX,
                y: (cy - rect.top) * scaleY
            };
        }

        function onDown(e) {
            e.preventDefault();
            const p = getPos(e);
            drawing = true;
            lastX = p.x; lastY = p.y;
            startX = p.x; startY = p.y;

            if (tool === 'fill') {
                floodFill(Math.floor(p.x), Math.floor(p.y), hexToRgba(color));
                pushHistory();
                drawing = false;
                return;
            }

            if (['line','rect','ellipse'].includes(tool)) {
                snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
            ctx.fillStyle = color;
            ctx.globalCompositeOperation = 'source-over';
            if (tool === 'pencil') {
                ctx.globalAlpha = 1;
            } else if (tool === 'brush') {
                ctx.globalAlpha = 0.7;
            } else if (tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
            }

            if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + 0.1, p.y + 0.1);
                ctx.stroke();
            }
        }

        function onMove(e) {
            if (!drawing) return;
            e.preventDefault();
            const p = getPos(e);

            if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                lastX = p.x; lastY = p.y;
            } else if (snapshot) {
                ctx.putImageData(snapshot, 0, 0);
                ctx.beginPath();
                if (tool === 'line') {
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                } else if (tool === 'rect') {
                    ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
                } else if (tool === 'ellipse') {
                    const cx = (startX + p.x) / 2;
                    const cy = (startY + p.y) / 2;
                    const rx = Math.abs(p.x - startX) / 2;
                    const ry = Math.abs(p.y - startY) / 2;
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }

        function onUp() {
            if (!drawing) return;
            drawing = false;
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            pushHistory();
        }

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointerleave', onUp);

        // Flood fill
        function floodFill(x, y, fillRgba) {
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = img.data;
            const w = canvas.width;
            const startPos = (y * w + x) * 4;
            const startR = data[startPos], startG = data[startPos + 1], startB = data[startPos + 2], startA = data[startPos + 3];
            if (startR === fillRgba.r && startG === fillRgba.g && startB === fillRgba.b && startA === fillRgba.a) return;
            const stack = [[x, y]];
            const tolerance = 32;
            const match = (i) => Math.abs(data[i] - startR) <= tolerance && Math.abs(data[i+1] - startG) <= tolerance && Math.abs(data[i+2] - startB) <= tolerance && Math.abs(data[i+3] - startA) <= tolerance;
            while (stack.length) {
                const [cx, cy] = stack.pop();
                if (cx < 0 || cy < 0 || cx >= w || cy >= canvas.height) continue;
                const i = (cy * w + cx) * 4;
                if (!match(i)) continue;
                data[i] = fillRgba.r; data[i+1] = fillRgba.g; data[i+2] = fillRgba.b; data[i+3] = fillRgba.a;
                stack.push([cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]);
            }
            ctx.putImageData(img, 0, 0);
        }

        function hexToRgba(hex) {
            const m = hex.replace('#','').match(/.{1,2}/g);
            return { r: parseInt(m[0],16), g: parseInt(m[1],16), b: parseInt(m[2],16), a: 255 };
        }

        // Keyboard
        const kbd = (e) => {
            if (!root.isConnected) return;
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
                else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
                else if (e.key === 's') { e.preventDefault(); save(); }
            }
        };
        document.addEventListener('keydown', kbd);
        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                document.removeEventListener('keydown', kbd);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        pushHistory();
        return root;
    }
};

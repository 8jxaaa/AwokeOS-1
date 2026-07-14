/**
 * Text Editor — open and edit text files from the VFS.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { getVFS } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';

export default {
    id: 'text-editor',
    name: 'Text Editor',
    icon: 'edit',
    category: 'Productivity',
    description: 'Edit plain text and code files',
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 400, height: 300 },

    async render({ args }) {
        const root = h('div', { class: 'app-root te-root' });

        let currentPath = args?.path || null;
        let dirty = false;

        // Toolbar
        const pathLabel = h('div', { class: 'te-path' }, currentPath || 'Untitled');
        const saveBtn = h('button', { class: 'btn btn-primary btn-sm', onClick: save, html: `${icon('save')} Save` });
        const newBtn = h('button', { class: 'btn btn-sm', onClick: newFile, html: `${icon('plus')} New` });
        const openBtn = h('button', { class: 'btn btn-sm', onClick: openFile, html: `${icon('folder-open')} Open` });
        const wordWrapBtn = h('button', { class: 'btn btn-sm', onClick: () => {
            editor.classList.toggle('wrap');
        }, html: `${icon('menu')} Wrap` });

        const toolbar = h('div', { class: 'app-toolbar' }, [newBtn, openBtn, saveBtn, wordWrapBtn, h('div', { class: 'flex-1' }), pathLabel]);

        // Editor
        const textarea = h('textarea', {
            class: 'te-textarea',
            spellcheck: 'false',
            placeholder: 'Start typing…',
            onInput: () => { dirty = true; updateStatus(); }
        });

        const lineGutter = h('div', { class: 'te-gutter' });
        const status = h('div', { class: 'te-status' }, 'Ready');

        const editorWrap = h('div', { class: 'te-editor' }, [lineGutter, textarea]);
        const editor = h('div', { class: 'te-main' }, [editorWrap, status]);

        root.appendChild(toolbar);
        root.appendChild(editor);

        function updateGutter() {
            const lines = textarea.value.split('\n').length;
            let html = '';
            for (let i = 1; i <= lines; i++) html += `<div>${i}</div>`;
            lineGutter.innerHTML = html;
            // Sync scroll
            lineGutter.scrollTop = textarea.scrollTop;
        }

        function updateStatus() {
            const text = textarea.value;
            const chars = text.length;
            const lines = text.split('\n').length;
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            status.textContent = `${lines} lines · ${words} words · ${chars} chars${dirty ? ' · Modified' : ''}`;
        }

        textarea.addEventListener('scroll', () => {
            lineGutter.scrollTop = textarea.scrollTop;
        });

        textarea.addEventListener('input', () => {
            updateGutter();
            updateStatus();
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') { e.preventDefault(); save(); }
                else if (e.key === 'o') { e.preventDefault(); openFile(); }
                else if (e.key === 'n') { e.preventDefault(); newFile(); }
            }
            // Tab insertion
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = textarea.selectionStart, en = textarea.selectionEnd;
                textarea.value = textarea.value.slice(0, s) + '  ' + textarea.value.slice(en);
                textarea.selectionStart = textarea.selectionEnd = s + 2;
                updateGutter();
                updateStatus();
            }
        });

        async function save() {
            if (!currentPath) {
                const name = prompt('Save as (path under /Documents):', '/Documents/untitled.txt');
                if (!name) return;
                currentPath = name.startsWith('/') ? name : '/Documents/' + name;
            }
            try {
                await getVFS().writeFile(currentPath, textarea.value);
                dirty = false;
                pathLabel.textContent = currentPath;
                updateStatus();
                bus.emit(EVENTS.TOAST, { type: 'success', message: 'Saved', duration: 1500 });
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Save failed: ' + err.message });
            }
        }

        function newFile() {
            if (dirty && !confirm('Discard unsaved changes?')) return;
            currentPath = null;
            textarea.value = '';
            dirty = false;
            pathLabel.textContent = 'Untitled';
            updateGutter();
            updateStatus();
        }

        async function openFile() {
            if (dirty && !confirm('Discard unsaved changes?')) return;
            bus.emit(EVENTS.APP_OPENED, { id: 'file-explorer', args: { pickFile: true, onPick: async (path) => {
                try {
                    const vfs = getVFS();
                    const text = await vfs.readText(path);
                    textarea.value = text;
                    currentPath = path;
                    pathLabel.textContent = path;
                    dirty = false;
                    updateGutter();
                    updateStatus();
                } catch (err) {
                    bus.emit(EVENTS.TOAST, { type: 'error', message: 'Open failed: ' + err.message });
                }
            }}});
        }

        // Load initial file
        if (currentPath) {
            try {
                const text = await getVFS().readText(currentPath);
                textarea.value = text;
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Open failed: ' + err.message });
            }
        }
        updateGutter();
        updateStatus();
        setTimeout(() => textarea.focus(), 50);

        return root;
    }
};

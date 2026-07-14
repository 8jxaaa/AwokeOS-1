/**
 * File Explorer — browse, create, rename, delete, copy/paste, drag/drop, import/export.
 */

import { h, clear } from '../../utils/dom.js';
import { icon, setIcon } from '../../assets/icons.js';
import { getVFS, ROOT_PATH } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';
import { openContextMenu } from '../../desktop/context-menu.js';
import { basename, join, dirname } from '../../filesystem/path-utils.js';

export default {
    id: 'file-explorer',
    name: 'File Explorer',
    icon: 'folder-open',
    category: 'System',
    description: 'Browse and manage your files',
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 500, height: 360 },
    singleton: false,

    async render({ windowId, args }) {
        const root = h('div', { class: 'app-root fe-root' });

        // Toolbar
        const backBtn = h('button', { class: 'btn-icon', html: icon('arrow-left'), onClick: () => navigate('back') });
        const fwdBtn = h('button', { class: 'btn-icon', html: icon('arrow-right'), onClick: () => navigate('forward') });
        const upBtn = h('button', { class: 'btn-icon', html: icon('chevron-up'), onClick: () => navigate('up') });
        const refreshBtn = h('button', { class: 'btn-icon', html: icon('refresh'), onClick: () => refresh() });

        const pathInput = h('input', { class: 'input', type: 'text', style: { flex: '1' }, onKeydown: (e) => {
            if (e.key === 'Enter') navigateTo(e.target.value);
        }});

        const newFolderBtn = h('button', { class: 'btn', onClick: () => createFolder() }, [
            h('span', { html: icon('plus') }), 'New folder'
        ]);
        const uploadBtn = h('button', { class: 'btn', onClick: () => triggerUpload() }, [
            h('span', { html: icon('upload') }), 'Upload'
        ]);
        const viewToggle = h('button', { class: 'btn-icon', html: icon('app'), onClick: () => toggleView() });

        const toolbar = h('div', { class: 'app-toolbar', style: { gap: '4px' } }, [
            backBtn, fwdBtn, upBtn, refreshBtn,
            pathInput,
            newFolderBtn, uploadBtn, viewToggle
        ]);

        // Sidebar (quick locations)
        const sidebar = h('div', { class: 'fe-sidebar' }, [
            sidebarItem('home', 'Home', '/'),
            sidebarItem('folder', 'Documents', '/Documents'),
            sidebarItem('image', 'Pictures', '/Pictures'),
            sidebarItem('music', 'Music', '/Music'),
            sidebarItem('video', 'Videos', '/Videos'),
            sidebarItem('download', 'Downloads', '/Downloads'),
            sidebarItem('home', 'Desktop', '/Desktop')
        ]);

        // File grid
        const grid = h('div', { class: 'fe-grid', tabIndex: '0' });

        // Status bar
        const status = h('div', { class: 'app-statusbar' });

        const content = h('div', { class: 'fe-content flex' }, [sidebar, grid]);

        root.appendChild(toolbar);
        root.appendChild(content);
        root.appendChild(status);

        // State
        let currentPath = args.path || ROOT_PATH;
        const history = [currentPath];
        let historyIdx = 0;
        let viewMode = 'grid'; // grid | list
        let selected = new Set();
        let clipboard = null; // { op: 'cut'|'copy', entries: [] }
        let draggedItems = [];

        const fileInput = h('input', { type: 'file', multiple: true, hidden: true, onChange: async (e) => {
            const vfs = getVFS();
            const items = [...e.target.files];
            if (items.length === 0) return;
            try {
                const entries = await vfs.importFiles(items, currentPath);
                bus.emit(EVENTS.TOAST, { type: 'success', message: `Imported ${entries.length} file(s)`, duration: 2500 });
                await refresh();
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Import failed: ' + err.message, duration: 3000 });
            }
            e.target.value = '';
        }});
        root.appendChild(fileInput);

        async function refresh() {
            pathInput.value = currentPath;
            await renderListing();
            await updateStatus();
        }

        async function renderListing() {
            const vfs = getVFS();
            grid.innerHTML = '';
            let entries = [];
            try {
                entries = await vfs.list(currentPath);
            } catch (err) {
                grid.appendChild(h('div', { class: 'empty-state' }, ['Failed to load: ' + err.message]));
                return;
            }
            if (entries.length === 0) {
                grid.appendChild(h('div', { class: 'empty-state' }, [
                    h('div', { html: icon('folder-open') }),
                    h('div', {}, 'This folder is empty'),
                    h('button', { class: 'btn btn-primary mt-2', onClick: createFolder }, 'Create folder')
                ]));
                return;
            }
            // Render entries
            for (const entry of entries) {
                grid.appendChild(renderEntry(entry));
            }
            updateStatusWithCount(entries.length);
        }

        function renderEntry(entry) {
            const ext = entry.name.split('.').pop().toLowerCase();
            const cat = entry.type === 'folder' ? 'folder' :
                ['png','jpg','jpeg','gif','webp','svg'].includes(ext) ? 'image' :
                ['mp3','wav','ogg','m4a','flac'].includes(ext) ? 'audio' :
                ['mp4','webm','mov','ogv'].includes(ext) ? 'video' :
                ['md','txt'].includes(ext) ? 'file-text' :
                ['js','ts','json','css','html','xml'].includes(ext) ? 'edit' :
                'file';
            const item = h('div', {
                class: `fe-item fe-${viewMode}`,
                dataset: { path: entry.path, type: entry.type },
                tabIndex: '0',
                draggable: 'true'
            }, [
                h('div', { class: 'fe-item-icon', html: icon(cat) }),
                h('div', { class: 'fe-item-name' }, entry.name),
                viewMode === 'list' ? h('div', { class: 'fe-item-meta' }, formatSize(entry.size)) : null,
                viewMode === 'list' ? h('div', { class: 'fe-item-meta' }, formatDate(entry.modifiedAt)) : null
            ]);
            // Selection
            item.addEventListener('click', (e) => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    selected.clear();
                    for (const i of grid.querySelectorAll('.fe-item.selected')) i.classList.remove('selected');
                }
                item.classList.toggle('selected');
                if (item.classList.contains('selected')) selected.add(entry.path);
                else selected.delete(entry.path);
            });
            item.addEventListener('dblclick', () => {
                if (entry.type === 'folder') {
                    navigateTo(join(currentPath, entry.name));
                } else {
                    openFile(entry);
                }
            });
            // Drag
            item.addEventListener('dragstart', (e) => {
                draggedItems = [entry];
                e.dataTransfer.setData('text/plain', entry.path);
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragover', (e) => {
                if (entry.type === 'folder') {
                    e.preventDefault();
                    item.classList.add('drag-over');
                }
            });
            item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (draggedItems.length === 0) return;
                const vfs = getVFS();
                try {
                    for (const it of draggedItems) {
                        if (it.path === entry.path) continue;
                        await vfs.move(it.path, join(currentPath, entry.name));
                    }
                    draggedItems = [];
                    await refresh();
                } catch (err) {
                    bus.emit(EVENTS.TOAST, { type: 'error', message: 'Move failed: ' + err.message });
                }
            });
            // Context menu
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!selected.has(entry.path)) {
                    selected.clear();
                    for (const i of grid.querySelectorAll('.fe-item.selected')) i.classList.remove('selected');
                    item.classList.add('selected');
                    selected.add(entry.path);
                }
                const items = [
                    { label: 'Open', icon: 'arrow-right', onClick: () => {
                        if (entry.type === 'folder') navigateTo(join(currentPath, entry.name));
                        else openFile(entry);
                    }},
                    { separator: true },
                    { label: 'Cut', icon: 'cut', shortcut: 'Ctrl+X', onClick: () => {
                        clipboard = { op: 'cut', entries: [...selected].map(p => ({ path: p })) };
                    }},
                    { label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C', onClick: () => {
                        clipboard = { op: 'copy', entries: [...selected].map(p => ({ path: p })) };
                    }},
                    { separator: true },
                    { label: 'Rename', icon: 'edit', onClick: () => renameItem(entry) },
                    { label: 'Delete', icon: 'trash', danger: true, shortcut: 'Del', onClick: () => deleteItems([entry]) },
                    { separator: true },
                    { label: 'Properties', icon: 'info', onClick: () => showProperties(entry) }
                ];
                if (entry.type === 'file') {
                    items.splice(1, 0, { label: 'Download', icon: 'download', onClick: () => downloadFile(entry) });
                }
                openContextMenu(e.clientX, e.clientY, items);
            });
            return item;
        }

        function navigate(direction) {
            if (direction === 'back' && historyIdx > 0) {
                historyIdx--;
                currentPath = history[historyIdx];
                refresh();
            } else if (direction === 'forward' && historyIdx < history.length - 1) {
                historyIdx++;
                currentPath = history[historyIdx];
                refresh();
            } else if (direction === 'up') {
                if (currentPath === '/') return;
                const parent = dirname(currentPath);
                navigateTo(parent);
            }
        }

        async function navigateTo(path) {
            const vfs = getVFS();
            const exists = await vfs.stat(path);
            if (!exists) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Path not found', duration: 2000 });
                return;
            }
            if (exists.type !== 'folder') {
                openFile(exists);
                return;
            }
            currentPath = path;
            // Truncate forward history
            history.length = historyIdx + 1;
            history.push(path);
            historyIdx = history.length - 1;
            await refresh();
        }

        function toggleView() {
            viewMode = viewMode === 'grid' ? 'list' : 'grid';
            grid.classList.toggle('fe-list-view', viewMode === 'list');
            refresh();
        }

        async function createFolder() {
            const name = prompt('Folder name:');
            if (!name) return;
            const vfs = getVFS();
            try {
                await vfs.mkdir(currentPath, name);
                await refresh();
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Create failed: ' + err.message });
            }
        }

        function triggerUpload() {
            fileInput.click();
        }

        async function deleteItems(items) {
            if (!confirm(`Delete ${items.length} item(s)? This cannot be undone.`)) return;
            const vfs = getVFS();
            let count = 0;
            for (const it of items) {
                try {
                    await vfs.remove(it.path, true);
                    count++;
                } catch (err) {
                    bus.emit(EVENTS.TOAST, { type: 'error', message: 'Delete failed: ' + err.message });
                }
            }
            if (count) bus.emit(EVENTS.TOAST, { type: 'success', message: `Deleted ${count} item(s)`, duration: 2000 });
            selected.clear();
            await refresh();
        }

        async function renameItem(entry) {
            const newName = prompt('New name:', entry.name);
            if (!newName || newName === entry.name) return;
            const vfs = getVFS();
            try {
                await vfs.rename(entry.path, newName);
                await refresh();
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Rename failed: ' + err.message });
            }
        }

        async function downloadFile(entry) {
            const vfs = getVFS();
            const blob = await vfs.exportFile(entry.path);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = entry.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function showProperties(entry) {
            const props = [
                `Name: ${entry.name}`,
                `Type: ${entry.type}`,
                entry.size != null ? `Size: ${formatSize(entry.size)}` : '',
                `Modified: ${new Date(entry.modifiedAt).toLocaleString()}`,
                `Path: ${entry.path}`
            ].filter(Boolean).join('\n');
            alert(props);
        }

        function openFile(entry) {
            const ext = entry.name.split('.').pop().toLowerCase();
            // Dispatch to appropriate app
            const cat = ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext) ? 'image-viewer'
                : ['mp3','wav','ogg','m4a','flac'].includes(ext) ? 'music-player'
                : ['mp4','webm','mov','ogv'].includes(ext) ? 'video-player'
                : ['md','markdown'].includes(ext) ? 'markdown-editor'
                : ['txt','js','ts','json','css','html','xml','py','java','c','cpp','go','rs','log'].includes(ext) ? 'text-editor'
                : null;
            if (cat) {
                bus.emit(EVENTS.APP_OPENED, { id: cat, args: { path: entry.path } });
            } else {
                downloadFile(entry);
            }
        }

        async function updateStatus() { await updateStatusWithCount(null); }
        async function updateStatusWithCount(count) {
            const vfs = getVFS();
            const stats = await vfs.getStats();
            status.innerHTML = `${count != null ? count + ' items' : ''} · ${stats.files} files · ${stats.folders} folders · ${formatSize(stats.totalSize)}`;
        }

        // Keyboard shortcuts
        const keyHandler = (e) => {
            if (!root.isConnected) return;
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c') {
                    e.preventDefault();
                    clipboard = { op: 'copy', entries: [...selected].map(p => ({ path: p })) };
                } else if (e.key === 'x') {
                    e.preventDefault();
                    clipboard = { op: 'cut', entries: [...selected].map(p => ({ path: p })) };
                } else if (e.key === 'v') {
                    e.preventDefault();
                    pasteClipboard();
                } else if (e.key === 'a') {
                    e.preventDefault();
                    for (const item of grid.querySelectorAll('.fe-item')) {
                        item.classList.add('selected');
                        selected.add(item.dataset.path);
                    }
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selected.size > 0) {
                    e.preventDefault();
                    const vfs = getVFS();
                    const paths = [...selected];
                    Promise.all(paths.map(p => vfs.stat(p).then(e => e).catch(() => null)))
                        .then(entries => deleteItems(entries.filter(Boolean)));
                }
            } else if (e.key === 'F2' && selected.size === 1) {
                e.preventDefault();
                const path = [...selected][0];
                getVFS().stat(path).then(e => e && renameItem(e));
            } else if (e.key === 'F5') {
                e.preventDefault();
                refresh();
            }
        };
        document.addEventListener('keydown', keyHandler);

        async function pasteClipboard() {
            if (!clipboard || clipboard.entries.length === 0) return;
            const vfs = getVFS();
            try {
                for (const item of clipboard.entries) {
                    if (clipboard.op === 'cut') {
                        await vfs.move(item.path, currentPath);
                    } else {
                        await vfs.copy(item.path, currentPath);
                    }
                }
                if (clipboard.op === 'cut') clipboard = null;
                bus.emit(EVENTS.TOAST, { type: 'success', message: 'Pasted', duration: 1500 });
                await refresh();
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Paste failed: ' + err.message });
            }
        }

        // Grid-level context menu (empty area)
        grid.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.fe-item')) return;
            e.preventDefault();
            openContextMenu(e.clientX, e.clientY, [
                { label: 'View', icon: 'app', onClick: toggleView },
                { label: 'Refresh', icon: 'refresh', onClick: refresh },
                { separator: true },
                { label: 'New folder', icon: 'folder', shortcut: 'Ctrl+Shift+N', onClick: createFolder },
                { label: 'Upload file', icon: 'upload', onClick: triggerUpload },
                { label: 'Paste', icon: 'paste', shortcut: 'Ctrl+V', disabled: !clipboard, onClick: pasteClipboard }
            ]);
        });

        // Refresh on FS changes
        const onFsChange = () => refresh();
        bus.on(EVENTS.FS_CHANGE, onFsChange);

        // Cleanup
        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                document.removeEventListener('keydown', keyHandler);
                bus.off(EVENTS.FS_CHANGE, onFsChange);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        await refresh();
        return root;
    }
};

function sidebarItem(iconKey, label, path) {
    const el = h('button', { class: 'fe-sidebar-item' }, [
        h('span', { html: icon(iconKey) }),
        h('span', {}, label)
    ]);
    el.addEventListener('click', () => {
        // Find sibling File Explorer window and navigate
        const layer = document.getElementById('windows-layer');
        for (const w of layer.querySelectorAll('.window')) {
            if (w.querySelector('.fe-root')) {
                const input = w.querySelector('.input');
                if (input) {
                    input.value = path;
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    // Bring window forward
                    w.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                }
                return;
            }
        }
        // Otherwise open new
        bus.emit(EVENTS.APP_OPENED, { id: 'file-explorer', args: { path } });
    });
    return el;
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B','KB','MB','GB','TB'];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

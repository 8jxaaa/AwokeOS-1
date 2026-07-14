/**
 * Virtual File System — main API for file/folder operations.
 *
 * Model:
 *   Each entry: { id, parentId, path, name, type ('file'|'folder'),
 *                 mimeType, size, content (Blob|Text|undefined),
 *                 createdAt, modifiedAt }
 *
 * Paths are absolute (e.g. "/Documents/notes.md").
 * The root ("/") is a synthetic folder with id = ROOT_ID.
 *
 * Exposes:
 *   - stat(path)             -> entry | null
 *   - list(path)             -> [entry]
 *   - mkdir(parentPath, name) -> entry
 *   - writeFile(path, data)  -> entry
 *   - readFile(path)         -> entry with content
 *   - rename(path, newName)  -> entry
 *   - move(srcPath, dstPath) -> entry
 *   - copy(srcPath, dstPath) -> entry
 *   - remove(path, recursive=true) -> void
 *   - search(query)          -> [entry]
 *   - importFiles(FileList)  -> [entry]
 *   - exportFile(path)       -> Blob
 *
 * Emits via bus:
 *   fs:change, fs:create, fs:rename, fs:delete, fs:paste
 */

import * as db from './indexeddb-store.js';
import { normalize, join, dirname, basename, extname, mimeType, isValidName, category } from './path-utils.js';
import { uid } from '../utils/id.js';
import { bus, EVENTS } from '../core/event-bus.js';

const ROOT_ID = 'root';
const ROOT_PATH = '/';
const SEP = '/';

export class VFS {
    constructor() {
        this._ready = this._init();
        // Expose globally for cross-module access
        window.AwokeOS = window.AwokeOS || {};
        window.AwokeOS.vfs = this;
    }

    async _init() {
        // Ensure root folder exists
        const root = await db.get(ROOT_ID);
        if (!root) {
            await db.put({
                id: ROOT_ID,
                parentId: null,
                path: ROOT_PATH,
                name: '',
                type: 'folder',
                createdAt: Date.now(),
                modifiedAt: Date.now()
            });
            // Create default folders
            const defaults = ['Documents', 'Pictures', 'Music', 'Videos', 'Downloads', 'Desktop'];
            for (const name of defaults) {
                await this._createFolderInternal(ROOT_ID, ROOT_PATH, name);
            }
            // Seed welcome content
            await this._seed();
        }
    }

    async _seed() {
        const welcome = {
            id: uid('f'),
            parentId: null, // will be set
            path: '/Documents/Welcome.md',
            name: 'Welcome.md',
            type: 'file',
            mimeType: 'text/markdown',
            size: 0,
            content: `# Welcome to AwokeOS!\n\nThis is your personal, browser-based operating system. Everything you do here — files, settings, apps, themes — is stored locally in your browser using **IndexedDB** and **localStorage**.\n\n## What you can do\n\n- Browse files with **File Explorer**\n- Run commands in **Terminal**\n- Customize appearance in **Settings**\n- Take notes in **Notes** or **Text Editor**\n- Draw in **Paint**\n- View images and play media\n\n## Tips\n\n- Right-click anywhere for context menus\n- Drag windows by their title bar\n- Snap windows by dragging to screen edges\n- Press the **Start** button (or Windows/Command key) to open the start menu\n\nEnjoy your new OS!\n`,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        const docs = await db.getByPath('/Documents');
        if (docs) {
            welcome.parentId = docs.id;
            await db.put(welcome);
        }

        const readme = {
            id: uid('f'),
            parentId: ROOT_ID,
            path: '/README.md',
            name: 'README.md',
            type: 'file',
            mimeType: 'text/markdown',
            size: 0,
            content: `# AwokeOS\n\nA modern, browser-based operating system.\n\n- All data is stored locally in your browser\n- No backend required\n- Works offline (after first load)\n`,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        await db.put(readme);
    }

    async ready() {
        await this._ready;
    }

    /* ============== Path resolution ============== */
    async _resolveParent(parentPath) {
        const p = normalize(parentPath);
        return db.getByPath(p);
    }
    async _createFolderInternal(parentId, parentPath, name) {
        const path = join(parentPath, name);
        const entry = {
            id: uid('f'),
            parentId,
            path,
            name,
            type: 'folder',
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        await db.put(entry);
        return entry;
    }

    /* ============== Core ops ============== */
    async stat(path) {
        await this.ready();
        const p = normalize(path);
        if (p === ROOT_PATH) {
            return {
                id: ROOT_ID, parentId: null, path: ROOT_PATH, name: '',
                type: 'folder', createdAt: 0, modifiedAt: 0
            };
        }
        return db.getByPath(p);
    }

    async exists(path) {
        return !!(await this.stat(path));
    }

    async isFolder(path) {
        const e = await this.stat(path);
        return e?.type === 'folder';
    }

    async isFile(path) {
        const e = await this.stat(path);
        return e?.type === 'file';
    }

    async list(path = ROOT_PATH) {
        await this.ready();
        const e = await this.stat(path);
        if (!e) throw new Error(`Path not found: ${path}`);
        if (e.type !== 'folder') throw new Error(`Not a folder: ${path}`);
        const children = await db.getByParent(e.id);
        // Sort: folders first, then alphabetically
        return children.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }

    async mkdir(parentPath, name) {
        await this.ready();
        if (!isValidName(name)) throw new Error('Invalid folder name');
        const parent = await this.stat(parentPath);
        if (!parent) throw new Error(`Parent not found: ${parentPath}`);
        if (parent.type !== 'folder') throw new Error(`Parent is not a folder: ${parentPath}`);
        const exists = await db.getByPath(join(parent.path, name));
        if (exists) throw new Error(`Folder already exists: ${name}`);
        const entry = await this._createFolderInternal(parent.id, parent.path, name);
        bus.emit(EVENTS.FS_CREATE, entry);
        bus.emit(EVENTS.FS_CHANGE, { type: 'create', path: entry.path });
        return entry;
    }

    async writeFile(path, data, opts = {}) {
        await this.ready();
        const p = normalize(path);
        const name = basename(p);
        if (!isValidName(name)) throw new Error('Invalid file name');
        const parentPath = dirname(p);
        let parent = await this.stat(parentPath);
        if (!parent) {
            // Auto-create parent if missing — only for direct parent
            parent = await this.mkdir(ROOT_PATH, parentPath.replace(ROOT_PATH, ''));
        }
        if (parent.type !== 'folder') throw new Error(`Parent is not a folder: ${parentPath}`);

        let existing = await db.getByPath(p);
        let content = data;
        let size = 0;
        if (data instanceof Blob) {
            size = data.size;
        } else if (typeof data === 'string') {
            size = new Blob([data]).size;
        } else if (data instanceof ArrayBuffer) {
            size = data.byteLength;
        } else if (data !== undefined && data !== null) {
            content = JSON.stringify(data, null, 2);
            size = new Blob([content]).size;
        }
        const now = Date.now();
        if (existing) {
            existing.content = content;
            existing.size = size;
            existing.mimeType = opts.mimeType || mimeType(name);
            existing.modifiedAt = now;
            await db.put(existing);
            bus.emit(EVENTS.FS_CHANGE, { type: 'update', path: p });
            return existing;
        }
        const entry = {
            id: uid('f'),
            parentId: parent.id,
            path: p,
            name,
            type: 'file',
            mimeType: opts.mimeType || mimeType(name),
            size,
            content,
            createdAt: now,
            modifiedAt: now
        };
        await db.put(entry);
        bus.emit(EVENTS.FS_CREATE, entry);
        bus.emit(EVENTS.FS_CHANGE, { type: 'create', path: p });
        return entry;
    }

    async readFile(path) {
        await this.ready();
        const e = await this.stat(path);
        if (!e) throw new Error(`File not found: ${path}`);
        if (e.type !== 'file') throw new Error(`Not a file: ${path}`);
        return db.get(e.id);
    }

    async readText(path) {
        const e = await this.readFile(path);
        if (e.content instanceof Blob) {
            return e.content.text();
        }
        return e.content ?? '';
    }

    async rename(path, newName) {
        await this.ready();
        if (!isValidName(newName)) throw new Error('Invalid name');
        const e = await this.stat(path);
        if (!e) throw new Error(`Not found: ${path}`);
        if (e.id === ROOT_ID) throw new Error('Cannot rename root');
        const parent = await db.get(e.parentId);
        const newPath = join(parent.path, newName);
        e.name = newName;
        e.path = newPath;
        e.modifiedAt = Date.now();
        await db.put(e);
        // Update all descendants if folder
        if (e.type === 'folder') {
            const all = await db.getAll();
            for (const child of all) {
                if (child.parentId === e.id || child.path.startsWith(e.path + '/')) {
                    const newChildPath = newPath + child.path.slice(e.path.length);
                    child.path = newChildPath;
                    await db.put(child);
                }
            }
        }
        bus.emit(EVENTS.FS_RENAME, { oldPath: path, newPath });
        bus.emit(EVENTS.FS_CHANGE, { type: 'rename', path: newPath });
        return e;
    }

    async move(srcPath, dstFolderPath) {
        await this.ready();
        const src = await this.stat(srcPath);
        if (!src) throw new Error(`Source not found: ${srcPath}`);
        if (src.id === ROOT_ID) throw new Error('Cannot move root');
        const dst = await this.stat(dstFolderPath);
        if (!dst || dst.type !== 'folder') throw new Error(`Destination not a folder: ${dstFolderPath}`);
        if (dst.path === srcPath || dst.path.startsWith(srcPath + '/')) {
            throw new Error('Cannot move folder into itself');
        }
        const newPath = join(dst.path, src.name);
        const exists = await db.getByPath(newPath);
        if (exists) throw new Error(`Destination already exists: ${newPath}`);
        src.parentId = dst.id;
        src.path = newPath;
        src.modifiedAt = Date.now();
        await db.put(src);
        if (src.type === 'folder') {
            const all = await db.getAll();
            for (const child of all) {
                if (child.parentId === src.id || child.path.startsWith(src.path + '/')) {
                    const oldPath = child.path;
                    child.path = newPath + child.path.slice(src.path.length);
                    if (child.parentId === src.id) {} // direct child — parent unchanged
                    await db.put(child);
                }
            }
        }
        bus.emit(EVENTS.FS_CHANGE, { type: 'move', src: srcPath, dst: newPath });
        return src;
    }

    async copy(srcPath, dstFolderPath, newName = null) {
        await this.ready();
        const src = await this.stat(srcPath);
        if (!src) throw new Error(`Source not found: ${srcPath}`);
        if (src.id === ROOT_ID) throw new Error('Cannot copy root');
        const dst = await this.stat(dstFolderPath);
        if (!dst || dst.type !== 'folder') throw new Error(`Destination not a folder`);
        const name = newName || src.name;
        const newPath = join(dst.path, name);
        const exists = await db.getByPath(newPath);
        if (exists) throw new Error(`Already exists: ${newPath}`);

        const fullSrc = await db.get(src.id);
        const copy = {
            ...fullSrc,
            id: uid('f'),
            parentId: dst.id,
            path: newPath,
            name,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        await db.put(copy);

        if (src.type === 'folder') {
            // Recursive copy
            await this._copyRecursive(src.id, copy.id, newPath);
        }
        bus.emit(EVENTS.FS_CHANGE, { type: 'copy', src: srcPath, dst: newPath });
        return copy;
    }

    async _copyRecursive(srcParentId, dstParentId, dstParentPath) {
        const children = await db.getByParent(srcParentId);
        for (const child of children) {
            const newChildPath = join(dstParentPath, child.name);
            const newChild = {
                ...child,
                id: uid('f'),
                parentId: dstParentId,
                path: newChildPath,
                createdAt: Date.now(),
                modifiedAt: Date.now()
            };
            await db.put(newChild);
            if (child.type === 'folder') {
                await this._copyRecursive(child.id, newChild.id, newChildPath);
            }
        }
    }

    async remove(path, recursive = true) {
        await this.ready();
        const e = await this.stat(path);
        if (!e) return false;
        if (e.id === ROOT_ID) throw new Error('Cannot delete root');
        if (e.type === 'folder' && recursive) {
            const all = await db.getAll();
            const toDelete = [];
            const queue = [e.id];
            while (queue.length) {
                const pid = queue.shift();
                toDelete.push(pid);
                for (const child of all) {
                    if (child.parentId === pid) queue.push(child.id);
                }
            }
            await db.deleteMany(toDelete);
        } else {
            await db.delete(e.id);
        }
        bus.emit(EVENTS.FS_DELETE, { path });
        bus.emit(EVENTS.FS_CHANGE, { type: 'delete', path });
        return true;
    }

    async tree(path = ROOT_PATH, depth = 0, maxDepth = 5) {
        await this.ready();
        const e = await this.stat(path);
        if (!e || e.type !== 'folder' || depth > maxDepth) return null;
        const children = await this.list(path);
        const out = {
            ...e,
            children: []
        };
        for (const child of children) {
            if (child.type === 'folder') {
                const sub = await this.tree(child.path, depth + 1, maxDepth);
                if (sub) out.children.push(sub);
            } else {
                out.children.push(child);
            }
        }
        return out;
    }

    async search(query) {
        await this.ready();
        const q = (query || '').toLowerCase();
        if (!q) return [];
        const all = await db.getAll();
        return all
            .filter(e => e.name.toLowerCase().includes(q))
            .sort((a, b) => b.modifiedAt - a.modifiedAt)
            .slice(0, 50);
    }

    /**
     * Import local files via <input type=file> or drag-drop.
     */
    async importFiles(fileList, targetFolder = '/') {
        await this.ready();
        const target = await this.stat(targetFolder);
        if (!target || target.type !== 'folder') throw new Error(`Bad target: ${targetFolder}`);
        const results = [];
        for (const file of fileList) {
            const path = join(target.path, file.name);
            // Read as Blob to preserve binary
            const blob = file instanceof Blob ? file : new Blob([file]);
            const entry = await this.writeFile(path, blob, { mimeType: file.type || mimeType(file.name) });
            results.push(entry);
        }
        return results;
    }

    /**
     * Export a file from VFS to a Blob for download.
     */
    async exportFile(path) {
        const e = await this.readFile(path);
        return e.content instanceof Blob ? e.content : new Blob([e.content ?? ''], { type: e.mimeType });
    }

    /**
     * Export a folder as ZIP (simple — uses store entries).
     * NOTE: Real ZIP requires a library; we provide JSON export instead.
     */
    async exportFolder(path) {
        const tree = await this.tree(path);
        const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
        return blob;
    }

    /**
     * Get the MIME category (image/audio/video/text/code/archive/file) for a path.
     */
    async getCategory(path) {
        const e = await this.stat(path);
        if (!e) return 'file';
        if (e.type === 'folder') return 'folder';
        return category(e.name);
    }

    async getStats() {
        const all = await db.getAll();
        const stats = {
            totalEntries: all.length,
            files: all.filter(e => e.type === 'file').length,
            folders: all.filter(e => e.type === 'folder').length,
            totalSize: all.filter(e => e.type === 'file').reduce((s, e) => s + (e.size || 0), 0)
        };
        const est = await db.estimate();
        stats.storageUsed = est.usage || 0;
        stats.storageQuota = est.quota || 0;
        return stats;
    }

    async clear() {
        await db.clear();
        await this._init();
        bus.emit(EVENTS.FS_CHANGE, { type: 'clear' });
    }
}

// Singleton instance
let _vfs = null;
export function getVFS() {
    if (!_vfs) _vfs = new VFS();
    return _vfs;
}

// Initialize eagerly so apps can use it immediately
getVFS();

export { ROOT_PATH, ROOT_ID };

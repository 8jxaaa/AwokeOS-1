/**
 * Recycle Bin — stores deleted files temporarily before permanent deletion.
 * Files are stored in VFS under a special /RecycleBin directory with metadata.
 */

import { getVFS } from '../filesystem/vfs.js';
import { bus, EVENTS } from '../core/event-bus.js';

const RECYCLE_PATH = '/RecycleBin';

export function getRecycleBin() {
    return { list, empty, restore, remove };
}

async function list() {
    const vfs = getVFS();
    if (!vfs) return [];
    try {
        const items = await vfs.readDir(RECYCLE_PATH);
        return items.map(f => ({
            name: f.name,
            originalPath: f.meta?.originalPath || '/',
            deletedAt: f.meta?.deletedAt || new Date().toISOString(),
            size: f.size
        }));
    } catch {
        return [];
    }
}

async function addToRecycle(name, originalPath) {
    const vfs = getVFS();
    if (!vfs) return;
    const now = new Date().toISOString();
    await vfs.writeMeta(`${RECYCLE_PATH}/${name}`, {
        originalPath,
        deletedAt: now,
        size: 0
    });
}

async function empty() {
    const vfs = getVFS();
    if (!vfs) return;
    const items = await list();
    for (const item of items) {
        await vfs.delete(`${RECYCLE_PATH}/${item.name}`);
    }
    bus.emit(EVENTS.RECYCLE_BIN_EMPTY);
}

async function restore(name) {
    const vfs = getVFS();
    if (!vfs) return;
    const items = await list();
    const item = items.find(f => f.name === name);
    if (item) {
        await vfs.move(`${RECYCLE_PATH}/${name}`, item.originalPath);
    }
    bus.emit(EVENTS.RECYCLE_BIN_RESTORE, { name });
/**
 * Recycle Bin — app for managing deleted files.
 * Shows files that were deleted, with options to restore or permanently delete.
 */

import { h } from '../../utils/dom.js';
import { getVFS } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';
import { icon } from '../../assets/icons.js';
import { getRecycleBin } from '../../desktop/recycle-bin.js';

export default {
    id: 'recycle-bin',
    name: 'Recycle Bin',
    icon: 'trash',
    category: 'System',
    description: 'View and manage deleted files',
    defaultSize: { width: 600, height: 450 },
    minSize: { width: 400, height: 300 },

    async render() {
        const root = h('div', { class: 'app-root recycle-bin-root', style: { padding: '16px' } });

        const items = await getRecycleBin().list();

        if (!items || items.length === 0) {
            root.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' } }, [
                h('div', { html: icon('trash'), style: { width: '48px', height: '48px', margin: '0 auto' } }),
                h('div', { style: { marginTop: '12px', fontSize: '14px' } }, 'Recycle Bin is empty')
            ]));
        } else {
            root.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px' } }, [
                h('span', { style: { fontSize: '14px' } }, `${items.length} item${items.length > 1 ? 's' : ''}`),
                h('button', { class: 'btn btn-sm btn-danger', onClick: async () => {
                    await getRecycleBin().empty();
                    bus.emit(EVENTS.RECYCLE_BIN_EMPTY);
                    root.innerHTML = '';
                    root.appendChild(h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' } }, 'Recycle Bin emptied'));
                }}, 'Empty Recycle Bin')
            ]));
            const table = h('table', { style: { width: '100%', borderCollapse: 'collapse' } });
            table.appendChild(h('thead', {}, [
                h('tr', {}, [
                    h('th', { style: { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-color)' } }, 'Name'),
                    h('th', { style: { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-color)' } }, 'Original Path'),
                    h('th', { style: { textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border-color)' } }, 'Deleted')
                ])
            ]));
            const tbody = h('tbody');
            for (const item of items) {
                tbody.appendChild(h('tr', {}, [
                    h('td', { style: { padding: '8px', borderBottom: '1px solid var(--border-color)' } }, item.name),
                    h('td', { style: { padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '12px' } }, item.originalPath),
                    h('td', { style: { padding: '8px', borderBottom: '1px solid var(--border-color)', textAlign: 'right' } }, [
                        h('button', { class: 'btn btn-sm', onClick: async () => {
                            await getRecycleBin().restore(item.name);
                            root.innerHTML = '';
                            root.appendChild(h('div', { style: { textAlign: 'center', padding: '40px' } }, 'Restored'));
                        }}, 'Restore')
                    ])
                ]));
            }
            table.appendChild(tbody);
            root.appendChild(table);
        }

        return root;
    }
};
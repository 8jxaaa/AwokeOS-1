/**
 * Notes — simple notebook with multiple notes.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { appData } from '../../services/persistence-service.js';
import { uid } from '../../utils/id.js';
import { bus, EVENTS } from '../../core/event-bus.js';

export default {
    id: 'notes',
    name: 'Notes',
    icon: 'note',
    category: 'Productivity',
    description: 'Quick notes and ideas',
    defaultSize: { width: 800, height: 560 },
    minSize: { width: 400, height: 320 },

    async render() {
        const root = h('div', { class: 'app-root notes-root' });

        // Sidebar with notes list
        const sidebar = h('div', { class: 'notes-sidebar' });
        const newBtn = h('button', { class: 'btn btn-primary w-full mb-2', onClick: createNote }, [
            h('span', { html: icon('plus') }), 'New note'
        ]);
        sidebar.appendChild(newBtn);
        const listEl = h('div', { class: 'notes-list scroll-y' });
        sidebar.appendChild(listEl);

        // Editor
        const titleInput = h('input', {
            class: 'notes-title',
            type: 'text',
            placeholder: 'Title',
            onInput: saveNote
        });
        const bodyInput = h('textarea', {
            class: 'notes-body',
            placeholder: 'Start writing…',
            onInput: saveNote
        });
        const editor = h('div', { class: 'notes-editor flex flex-col' }, [
            h('div', { class: 'notes-toolbar' }, [
                h('button', { class: 'btn-icon', title: 'Bold', html: '<strong>B</strong>', onClick: () => wrap('**') }),
                h('button', { class: 'btn-icon', title: 'Italic', html: '<em>I</em>', onClick: () => wrap('*') }),
                h('button', { class: 'btn-icon', title: 'Underline', html: '<u>U</u>', onClick: () => wrap('__') }),
                h('button', { class: 'btn-icon', title: 'Bullet list', html: '•', onClick: () => insertLine('- ') }),
                h('button', { class: 'btn-icon', title: 'Numbered list', html: '1.', onClick: () => insertLine('1. ') }),
                h('button', { class: 'btn-icon', title: 'Code', html: '</>', onClick: () => wrap('`') }),
                h('button', { class: 'btn-icon', title: 'Delete', html: icon('trash'), onClick: deleteCurrent })
            ]),
            titleInput,
            bodyInput,
            h('div', { class: 'notes-status' }, [
                h('span', { id: 'notes-status-text' }, 'Ready')
            ])
        ]);

        const layout = h('div', { class: 'notes-layout' }, [sidebar, editor]);
        root.appendChild(layout);

        let notes = appData.get('notes', 'all', []) || [];
        if (!Array.isArray(notes)) notes = [];
        if (notes.length === 0) notes.push(createBlank());
        let currentId = notes[0]?.id;

        function createBlank() {
            return { id: uid('note'), title: '', body: '', createdAt: Date.now(), modifiedAt: Date.now() };
        }

        function renderList() {
            listEl.innerHTML = '';
            for (const note of notes) {
                const item = h('div', {
                    class: 'notes-list-item ' + (note.id === currentId ? 'active' : ''),
                    onClick: () => selectNote(note.id)
                }, [
                    h('div', { class: 'notes-list-title' }, note.title || 'Untitled'),
                    h('div', { class: 'notes-list-preview' }, (note.body || '').slice(0, 80) || 'No content'),
                    h('div', { class: 'notes-list-date' }, new Date(note.modifiedAt).toLocaleDateString())
                ]);
                item.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    import('../../desktop/context-menu.js').then(({ openContextMenu }) => {
                        openContextMenu(e.clientX, e.clientY, [
                            { label: 'Open', icon: 'arrow-right', onClick: () => selectNote(note.id) },
                            { separator: true },
                            { label: 'Delete', icon: 'trash', danger: true, onClick: () => deleteNote(note.id) }
                        ]);
                    });
                });
                listEl.appendChild(item);
            }
        }

        function selectNote(id) {
            saveNote();
            currentId = id;
            const note = notes.find(n => n.id === id);
            if (note) {
                titleInput.value = note.title || '';
                bodyInput.value = note.body || '';
            }
            renderList();
        }

        function createNote() {
            saveNote();
            const n = createBlank();
            notes.unshift(n);
            currentId = n.id;
            titleInput.value = '';
            bodyInput.value = '';
            renderList();
            titleInput.focus();
        }

        function deleteCurrent() {
            if (notes.length === 0) return;
            if (!confirm('Delete this note?')) return;
            deleteNote(currentId);
        }

        function deleteNote(id) {
            notes = notes.filter(n => n.id !== id);
            if (notes.length === 0) notes.push(createBlank());
            if (currentId === id) currentId = notes[0].id;
            appData.set('notes', 'all', notes);
            selectNote(currentId);
        }

        function saveNote() {
            const note = notes.find(n => n.id === currentId);
            if (!note) return;
            note.title = titleInput.value;
            note.body = bodyInput.value;
            note.modifiedAt = Date.now();
            appData.set('notes', 'all', notes);
            const status = document.getElementById('notes-status-text');
            if (status) status.textContent = 'Saved · ' + new Date().toLocaleTimeString();
            // Update list preview
            renderList();
        }

        function wrap(s) {
            const start = bodyInput.selectionStart, end = bodyInput.selectionEnd;
            const val = bodyInput.value;
            const sel = val.slice(start, end);
            bodyInput.value = val.slice(0, start) + s + sel + s + val.slice(end);
            bodyInput.focus();
            bodyInput.selectionStart = start + s.length;
            bodyInput.selectionEnd = end + s.length;
            saveNote();
        }

        function insertLine(prefix) {
            const start = bodyInput.selectionStart;
            const val = bodyInput.value;
            const before = val.slice(0, start);
            const needsNewline = before.length > 0 && !before.endsWith('\n');
            bodyInput.value = before + (needsNewline ? '\n' : '') + prefix + val.slice(start);
            bodyInput.focus();
            bodyInput.selectionStart = bodyInput.selectionEnd = start + (needsNewline ? 1 : 0) + prefix.length;
            saveNote();
        }

        // Initial selection
        selectNote(currentId);

        // Auto-save every 5 seconds
        const interval = setInterval(saveNote, 5000);
        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                clearInterval(interval);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return root;
    }
};

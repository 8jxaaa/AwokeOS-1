/**
 * Markdown Editor — write markdown with live preview.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { getVFS } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';
import { sanitizeHTML, escapeHTML } from '../../utils/sanitizer.js';

export default {
    id: 'markdown-editor',
    name: 'Markdown Editor',
    icon: 'markdown',
    category: 'Productivity',
    description: 'Edit markdown with live preview',
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 500, height: 320 },

    async render({ args }) {
        const root = h('div', { class: 'app-root md-root' });
        let currentPath = args?.path || null;

        const textarea = h('textarea', {
            class: 'md-edit',
            placeholder: '# Start writing markdown…',
            spellcheck: 'false',
            onInput: () => { updatePreview(); saveNote(); }
        });

        const preview = h('div', { class: 'md-preview scroll-y' });

        const saveBtn = h('button', { class: 'btn btn-primary btn-sm', onClick: save, html: `${icon('save')} Save` });
        const openBtn = h('button', { class: 'btn btn-sm', onClick: openFile, html: `${icon('folder-open')} Open` });
        const toolbar = h('div', { class: 'app-toolbar' }, [
            h('div', { class: 'flex gap-2' }, [openBtn, saveBtn]),
            h('div', { class: 'flex-1' }),
            h('div', { class: 'flex gap-1' }, [
                h('button', { class: 'btn btn-sm', title: 'Bold (Ctrl+B)', html: '<strong>B</strong>', onClick: () => wrap('**') }),
                h('button', { class: 'btn btn-sm', title: 'Italic', html: '<em>I</em>', onClick: () => wrap('*') }),
                h('button', { class: 'btn btn-sm', title: 'Code', html: '</>', onClick: () => wrap('`') }),
                h('button', { class: 'btn btn-sm', title: 'Link', html: icon('link'), onClick: () => insert('[', '](https://)') }),
                h('button', { class: 'btn btn-sm', title: 'Image', html: icon('picture'), onClick: () => insert('![', '](https://)') }),
                h('button', { class: 'btn btn-sm', title: 'List', html: '•', onClick: () => insertLine('- ') }),
                h('button', { class: 'btn btn-sm', title: 'Heading', html: 'H', onClick: () => insertLine('## ') })
            ]),
            h('div', { class: 'flex-1' }),
            h('div', { class: 'text-sm text-secondary' }, currentPath || 'Untitled')
        ]);

        const split = h('div', { class: 'md-split' }, [textarea, preview]);
        root.appendChild(toolbar);
        root.appendChild(split);

        function updatePreview() {
            preview.innerHTML = renderMarkdown(textarea.value);
        }

        function renderMarkdown(src) {
            // Simple markdown renderer (headings, bold, italic, code, links, lists, blockquotes, hr)
            let html = escapeHTML(src);
            // Code blocks
            html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
            // Inline code
            html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
            // Headings
            html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
            html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
            html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
            html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
            html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
            html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
            // Bold
            html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
            // Italic
            html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
            html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
            // Links
            html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
            // Images
            html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">');
            // HR
            html = html.replace(/^---$/gm, '<hr>');
            // Blockquote
            html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
            // Lists
            html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
            html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
            // Numbered lists
            html = html.replace(/^\d+\.\s+(.+)$/gm, '<oli>$1</oli>');
            html = html.replace(/(<oli>.*<\/oli>\n?)+/g, (m) => `<ol>${m.replace(/oli/g, 'li')}</ol>`);
            // Paragraphs (blank line splits)
            html = html.split(/\n\n+/).map(p => {
                if (/^<(h\d|ul|ol|pre|blockquote|hr)/.test(p.trim())) return p;
                if (p.trim() === '') return '';
                return `<p>${p.replace(/\n/g, '<br>')}</p>`;
            }).join('\n');
            return sanitizeHTML(html);
        }

        function wrap(s) {
            const s2 = textarea.selectionStart, e = textarea.selectionEnd;
            const v = textarea.value;
            const sel = v.slice(s2, e);
            textarea.value = v.slice(0, s2) + s + sel + s + v.slice(e);
            textarea.focus();
            textarea.selectionStart = s2 + s.length;
            textarea.selectionEnd = e + s.length;
            updatePreview();
            saveNote();
        }
        function insert(before, after = '') {
            const s = textarea.selectionStart, e = textarea.selectionEnd;
            const v = textarea.value;
            const sel = v.slice(s, e);
            textarea.value = v.slice(0, s) + before + sel + after + v.slice(e);
            textarea.focus();
            textarea.selectionStart = s + before.length;
            textarea.selectionEnd = e + before.length;
            updatePreview();
            saveNote();
        }
        function insertLine(prefix) {
            const s = textarea.selectionStart;
            const v = textarea.value;
            const before = v.slice(0, s);
            const needsNl = before.length > 0 && !before.endsWith('\n');
            textarea.value = before + (needsNl ? '\n' : '') + prefix + v.slice(s);
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = s + (needsNl ? 1 : 0) + prefix.length;
            updatePreview();
            saveNote();
        }

        async function save() {
            if (!currentPath) {
                const name = prompt('Save as (path under /Documents):', '/Documents/notes.md');
                if (!name) return;
                currentPath = name.startsWith('/') ? name : '/Documents/' + name;
            }
            try {
                await getVFS().writeFile(currentPath, textarea.value);
                bus.emit(EVENTS.TOAST, { type: 'success', message: 'Saved', duration: 1500 });
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Save failed: ' + err.message });
            }
        }
        function saveNote() {
            if (currentPath) getVFS().writeFile(currentPath, textarea.value).catch(() => {});
        }
        function openFile() {
            bus.emit(EVENTS.APP_OPENED, { id: 'file-explorer', args: { pickFile: true, filter: 'markdown', onPick: async (path) => {
                try {
                    textarea.value = await getVFS().readText(path);
                    currentPath = path;
                    updatePreview();
                } catch (err) {
                    bus.emit(EVENTS.TOAST, { type: 'error', message: 'Open failed: ' + err.message });
                }
            }}});
        }

        if (currentPath) {
            try {
                textarea.value = await getVFS().readText(currentPath);
            } catch (e) {}
        } else {
            textarea.value = `# Welcome to Markdown Editor\n\nWrite **bold**, *italic*, or \`code\` inline.\n\n## Lists\n\n- Item one\n- Item two\n- Item three\n\n## Code\n\n\`\`\`js\nfunction hello() {\n  console.log('Hi!');\n}\n\`\`\`\n\n> Blockquote example\n\n[Link](https://example.com)\n`;
        }
        updatePreview();
        return root;
    }
};

/**
 * Terminal — a shell-like command interface over the VFS.
 *
 * Built-in commands:
 *   help, clear, echo, pwd, ls, cd, mkdir, touch, rm, cat, tree,
 *   date, time, history, whoami, theme, shutdown, restart, neofetch,
 *   open, exit, man
 *
 * Custom commands can be registered via registerCommand().
 */

import { h } from '../../utils/dom.js';
import { getVFS, ROOT_PATH } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';
import { getThemeService } from '../../services/theme-service.js';
import { getState } from '../../core/state-manager.js';
import { escapeHTML } from '../../utils/sanitizer.js';
import { normalize, basename, dirname } from '../../filesystem/path-utils.js';

const commands = new Map();

function registerCommand(name, def) {
    commands.set(name, def);
}

// Built-in commands
registerCommand('help', {
    description: 'Show available commands',
    usage: 'help [command]',
    execute: (args, ctx) => {
        if (args[0]) {
            const c = commands.get(args[0]);
            if (!c) return { output: `Unknown command: ${args[0]}`, color: 'error' };
            return {
                output: `${args[0]}\n  ${c.description}\n  Usage: ${c.usage || args[0]}`
            };
        }
        const names = [...commands.keys()].sort();
        const max = Math.max(...names.map(n => n.length));
        return {
            output: `Available commands:\n\n${names.map(n => `  ${n.padEnd(max + 2)}${commands.get(n).description}`).join('\n')}\n\nType 'help <command>' for details.`
        };
    }
});

registerCommand('clear', {
    description: 'Clear the screen',
    execute: (args, ctx) => ({ clear: true })
});

registerCommand('echo', {
    description: 'Print arguments',
    execute: (args) => ({ output: args.join(' ') })
});

registerCommand('pwd', {
    description: 'Print working directory',
    execute: (args, ctx) => ({ output: ctx.cwd })
});

registerCommand('ls', {
    description: 'List directory contents',
    usage: 'ls [path]',
    execute: async (args, ctx) => {
        const target = args[0] ? resolvePath(args[0], ctx.cwd) : ctx.cwd;
        try {
            const vfs = getVFS();
            const entries = await vfs.list(target);
            if (entries.length === 0) return { output: '(empty)' };
            return { output: entries.map(e => {
                const marker = e.type === 'folder' ? '/' : '';
                return `${e.name}${marker}`;
            }).join('\n') };
        } catch (err) {
            return { output: 'ls: ' + err.message, color: 'error' };
        }
    }
});

registerCommand('cd', {
    description: 'Change directory',
    usage: 'cd [path]',
    execute: (args, ctx) => {
        if (!args[0]) {
            ctx.setCwd(ROOT_PATH);
            return {};
        }
        const target = resolvePath(args[0], ctx.cwd);
        // Special
        if (target === '~') {
            ctx.setCwd(ROOT_PATH);
            return {};
        }
        // Validate synchronously by checking path exists
        const vfs = getVFS();
        return vfs.stat(target).then(s => {
            if (!s) { ctx.writeErr(`cd: no such file or directory: ${target}`); return {}; }
            if (s.type !== 'folder') { ctx.writeErr(`cd: not a directory: ${target}`); return {}; }
            ctx.setCwd(target);
            return {};
        });
    }
});

registerCommand('mkdir', {
    description: 'Create a directory',
    usage: 'mkdir <name>',
    execute: async (args, ctx) => {
        if (!args[0]) return { output: 'mkdir: missing operand', color: 'error' };
        const vfs = getVFS();
        try {
            await vfs.mkdir(ctx.cwd, args[0]);
            return { output: '' };
        } catch (err) {
            return { output: 'mkdir: ' + err.message, color: 'error' };
        }
    }
});

registerCommand('touch', {
    description: 'Create an empty file',
    usage: 'touch <name>',
    execute: async (args, ctx) => {
        if (!args[0]) return { output: 'touch: missing operand', color: 'error' };
        const vfs = getVFS();
        const path = ctx.cwd === '/' ? '/' + args[0] : ctx.cwd + '/' + args[0];
        try {
            await vfs.writeFile(path, '');
            return { output: '' };
        } catch (err) {
            return { output: 'touch: ' + err.message, color: 'error' };
        }
    }
});

registerCommand('rm', {
    description: 'Remove file or folder',
    usage: 'rm <path>',
    execute: async (args, ctx) => {
        if (!args[0]) return { output: 'rm: missing operand', color: 'error' };
        const vfs = getVFS();
        const target = resolvePath(args[0], ctx.cwd);
        try {
            await vfs.remove(target);
            return { output: '' };
        } catch (err) {
            return { output: 'rm: ' + err.message, color: 'error' };
        }
    }
});

registerCommand('cat', {
    description: 'Print file contents',
    usage: 'cat <path>',
    execute: async (args, ctx) => {
        if (!args[0]) return { output: 'cat: missing operand', color: 'error' };
        const vfs = getVFS();
        const target = resolvePath(args[0], ctx.cwd);
        try {
            const text = await vfs.readText(target);
            return { output: text };
        } catch (err) {
            return { output: 'cat: ' + err.message, color: 'error' };
        }
    }
});

registerCommand('tree', {
    description: 'Show directory tree',
    usage: 'tree [path]',
    execute: async (args, ctx) => {
        const target = args[0] ? resolvePath(args[0], ctx.cwd) : ctx.cwd;
        try {
            const vfs = getVFS();
            const tree = await vfs.tree(target, 0, 8);
            return { output: renderTree(tree, '') };
        } catch (err) {
            return { output: 'tree: ' + err.message, color: 'error' };
        }
    }
});

registerCommand('date', {
    description: 'Show current date/time',
    execute: () => ({ output: new Date().toString() })
});

registerCommand('time', {
    description: 'Show current time',
    execute: () => ({ output: new Date().toLocaleTimeString() })
});

registerCommand('history', {
    description: 'Show command history',
    execute: (args, ctx) => {
        return { output: ctx.history.map((h, i) => `${i + 1}  ${h}`).join('\n') };
    }
});

registerCommand('whoami', {
    description: 'Show current user',
    execute: () => ({ output: getState().get('username') || 'user' })
});

registerCommand('theme', {
    description: 'Get/set theme',
    usage: 'theme [light|dark|amoled|glassmorphism|windows|macos|linux]',
    execute: (args) => {
        if (!args[0]) {
            return { output: `Current theme: ${getState().get('theme')}\nAvailable: light, dark, amoled, glassmorphism, windows, macos, linux` };
        }
        const valid = ['light','dark','amoled','glassmorphism','windows','macos','linux'];
        if (!valid.includes(args[0])) return { output: `theme: unknown theme '${args[0]}'`, color: 'error' };
        getThemeService().applyTheme(args[0]);
        return { output: `Theme set to ${args[0]}` };
    }
});

registerCommand('wallpaper', {
    description: 'Set wallpaper',
    usage: 'wallpaper <id>',
    execute: (args) => {
        if (!args[0]) return { output: 'Usage: wallpaper <id>' };
        bus.emit('wallpaper:set', args[0]);
        return { output: `Wallpaper set to ${args[0]}` };
    }
});

registerCommand('neofetch', {
    description: 'Show system info',
    execute: () => {
        const theme = getState().get('theme');
        const accent = getState().get('accent');
        return {
            output: `<span class="term-ascii">        ▄██████████████▄
       ██              ██
      ██   ${escapeHTML(getState().get('username') || 'user')}@awokeos   ██
      ██   ─────────── ██
      ██   OS: AwokeOS v1.0
      ██   Kernel: Browser ESM
      ██   Theme: ${theme}
      ██   Accent: ${accent}
      ██   Uptime: ${formatUptime()}
       ██              ██
        ▀██████████████▀</span>`
        };
    }
});

registerCommand('open', {
    description: 'Open an app or file',
    usage: 'open <app-id>',
    execute: async (args) => {
        if (!args[0]) return { output: 'open: missing operand', color: 'error' };
        bus.emit(EVENTS.APP_OPENED, { id: args[0] });
        return { output: `Opening ${args[0]}…` };
    }
});

registerCommand('shutdown', {
    description: 'Shut down the OS (reloads)',
    execute: () => {
        bus.emit(EVENTS.POWER_SHUTDOWN);
        return { output: 'Shutting down…' };
    }
});

registerCommand('restart', {
    description: 'Restart the OS (reloads)',
    execute: () => {
        bus.emit(EVENTS.POWER_RESTART);
        return { output: 'Restarting…' };
    }
});

registerCommand('exit', {
    description: 'Close the terminal window',
    execute: (args, ctx) => {
        ctx.close();
        return {};
    }
});

registerCommand('man', {
    description: 'Show manual for a command',
    execute: (args, ctx) => commands.get('help').execute(args, ctx)
});

function resolvePath(path, cwd) {
    if (!path) return cwd;
    if (path.startsWith('/')) return normalize(path);
    if (path === '~') return ROOT_PATH;
    if (path === '..') return dirname(cwd);
    if (path === '.') return cwd;
    return normalize(join2(cwd, path));
}
function join2(a, b) {
    if (a.endsWith('/')) return a + b;
    return a + '/' + b;
}

function formatUptime() {
    const ms = Date.now() - (window._awokeosStart || Date.now());
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

function renderTree(node, prefix) {
    if (!node) return '';
    const iconKey = node.type === 'folder' ? 'folder' : 'file';
    let out = prefix + icon(iconKey) + ' ' + node.name + '\n';
    if (node.children) {
        node.children.forEach((c, i) => {
            const isLast = i === node.children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const extension = isLast ? '    ' : '│   ';
            const childPrefix = prefix + connector;
            out += renderTree(c, prefix + (i === node.children.length - 1 ? '    ' : '│   '));
        });
    }
    return out;
}

export function registerCommandExt(name, def) {
    registerCommand(name, def);
}

export default {
    id: 'terminal',
    name: 'Terminal',
    icon: 'terminal',
    category: 'System',
    description: 'Command-line interface for AwokeOS',
    defaultSize: { width: 760, height: 480 },
    minSize: { width: 400, height: 280 },

    async render({ windowId }) {
        const root = h('div', { class: 'app-root term-root' });
        if (!window._awokeosStart) window._awokeosStart = Date.now();

        const output = h('div', { class: 'term-output', tabIndex: '0' });
        const inputRow = h('div', { class: 'term-input-row' });
        const promptEl = h('span', { class: 'term-prompt' });
        const input = h('input', {
            class: 'term-input',
            type: 'text',
            autocomplete: 'off',
            spellcheck: 'false',
            onKeydown: (e) => onKey(e)
        });

        inputRow.appendChild(promptEl);
        inputRow.appendChild(input);
        root.appendChild(output);
        root.appendChild(inputRow);

        // State
        let cwd = ROOT_PATH;
        const history = [];
        let historyIdx = -1;
        let currentInput = '';

        const ctx = {
            get cwd() { return cwd; },
            setCwd(p) { cwd = p; promptEl.textContent = `${getState().get('username') || 'user'}@awokeos:${cwd}$`; },
            history,
            writeErr: (msg) => writeLine(msg, 'error'),
            close: () => {
                const win = root.closest('.window');
                if (win) win.querySelector('.window-btn.close')?.click();
            }
        };

        const writeLine = (text, color = 'normal', html = false) => {
            const line = h('div', { class: `term-line term-${color}` });
            if (html) line.innerHTML = text;
            else line.textContent = text;
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
        };

        const writeHTML = (html) => {
            const line = h('div', { class: 'term-line' });
            line.innerHTML = html;
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
        };

        const writePrompt = (cmd) => {
            const line = h('div', { class: 'term-line term-cmd' });
            line.innerHTML = `<span class="term-prompt">${escapeHTML(getState().get('username') || 'user')}@awokeos:${escapeHTML(cwd)}$</span> ${escapeHTML(cmd)}`;
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
        };

        const clearScreen = () => {
            output.innerHTML = '';
        };

        const printBanner = () => {
            writeHTML(`<pre class="term-banner">
 ▄▄▄      ▓█████  ▒█████   ██ ▄█▀▓█████  ▒█████   █████ 
▒████▄    ▓█   ▀ ▒██▒  ██▒ ██▄█▒ ▓█   ▀ ▒██▒  ██▒▒██▓  ██▒
▒██  ▀█▄  ▒███   ▒██░  ██▒▓███▄░ ▒███   ▒██░  ██▒▒██▒  ██░
░██▄▄▄▄██ ▒▓█  ▄ ▒██   ██░▓██ █▄ ▒▓█  ▄ ▒██   ██░▒██░  ██░
 ▓█   ▓██▒░▒████▒░ ████▓▒░▒██▒ █▄░▒████▒░ ████▓▒░░██████▒░
 ▒▒   ▓▒█░░░ ▒░ ░░ ▒░▒░▒░ ▒ ▒▒ ▓▒░░ ▒░ ░░ ▒░▒░▒░ ░ ▒░▓  ░ 
</pre>`);
            writeLine('AwokeOS Terminal v1.0 — type "help" for commands');
            writeLine('');
        };

        async function onKey(e) {
            if (e.key === 'Enter') {
                const cmd = input.value;
                writePrompt(cmd);
                input.value = '';
                if (cmd.trim()) {
                    history.push(cmd);
                    historyIdx = history.length;
                    await executeCommand(cmd);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIdx > 0) {
                    if (historyIdx === history.length) currentInput = input.value;
                    historyIdx--;
                    input.value = history[historyIdx] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIdx < history.length) {
                    historyIdx++;
                    input.value = historyIdx === history.length ? currentInput : (history[historyIdx] || '');
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                // Simple completion
                const partial = input.value.split(' ').pop();
                if (partial) {
                    const matches = [...commands.keys()].filter(c => c.startsWith(partial));
                    if (matches.length === 1) {
                        const parts = input.value.split(' ');
                        parts[parts.length - 1] = matches[0];
                        input.value = parts.join(' ');
                    } else if (matches.length > 1) {
                        writeLine(matches.join('  '), 'muted');
                    }
                }
            } else if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                clearScreen();
            } else if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                writePrompt(input.value + '^C');
                input.value = '';
            }
        }

        async function executeCommand(line) {
            const parts = parseCommand(line);
            const cmd = parts[0];
            const args = parts.slice(1);
            const def = commands.get(cmd);
            if (!def) {
                writeLine(`${cmd}: command not found. Type 'help' for available commands.`, 'error');
                return;
            }
            try {
                const result = await def.execute(args, ctx);
                if (!result) return;
                if (result.clear) clearScreen();
                if (result.output) {
                    if (result.color === 'error') writeLine(result.output, 'error');
                    else if (/<[a-z][\s\S]*>/i.test(result.output)) writeHTML(result.output);
                    else writeLine(result.output);
                }
            } catch (err) {
                writeLine(`Error: ${err.message}`, 'error');
            }
        }

        function parseCommand(line) {
            // Simple tokenizer with quote support
            const parts = [];
            let cur = '', quote = null;
            for (const ch of line) {
                if (quote) {
                    if (ch === quote) { quote = null; }
                    else cur += ch;
                } else if (ch === '"' || ch === "'") {
                    quote = ch;
                } else if (ch === ' ') {
                    if (cur) { parts.push(cur); cur = ''; }
                } else {
                    cur += ch;
                }
            }
            if (cur) parts.push(cur);
            return parts;
        }

        // Initialize
        ctx.setCwd(cwd);
        printBanner();
        setTimeout(() => input.focus(), 50);

        // Keep focus
        root.addEventListener('click', () => input.focus());

        return root;
    }
};

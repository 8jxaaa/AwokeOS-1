/**
 * Keyboard shortcut manager.
 * Bindings stored as normalized strings like "ctrl+s", "ctrl+shift+n", "alt+tab".
 *
 * Usage:
 *   shortcuts.bind('ctrl+s', () => save());
 *   shortcuts.unbind('ctrl+s');
 *   shortcuts.bindGlobal('escape', () => closeMenu());
 */

class ShortcutManager {
    constructor() {
        this._bindings = new Map();     // keyCombo -> { handler, scope, preventDefault }
        this._scopeStack = ['global'];
        this._enabled = true;
        this._init();
    }
    _init() {
        document.addEventListener('keydown', (e) => this._onKey(e));
    }

    _onKey(e) {
        if (!this._enabled) return;
        // Ignore when typing in an editable field (unless modifier used)
        const target = e.target;
        const isEditable = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );
        if (isEditable && !e.ctrlKey && !e.metaKey && !e.altKey) return;

        const combo = this._comboFromEvent(e);
        const binding = this._bindings.get(combo);
        if (binding) {
            // scope check
            if (binding.scope && binding.scope !== this._scopeStack[this._scopeStack.length - 1] && binding.scope !== 'global') {
                return;
            }
            if (binding.preventDefault !== false) e.preventDefault();
            binding.handler(e);
        }
    }

    _comboFromEvent(e) {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('mod'); // mod = ctrl or cmd
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        let key = e.key.toLowerCase();
        // Normalize
        if (key === ' ') key = 'space';
        if (key === 'escape') key = 'esc';
        if (key === 'arrowup') key = 'up';
        if (key === 'arrowdown') key = 'down';
        if (key === 'arrowleft') key = 'left';
        if (key === 'arrowright') key = 'right';
        parts.push(key);
        return parts.join('+');
    }

    bind(combo, handler, options = {}) {
        const { scope = 'global', preventDefault = true } = options;
        this._bindings.set(combo.toLowerCase(), { handler, scope, preventDefault });
    }

    unbind(combo) {
        this._bindings.delete(combo.toLowerCase());
    }

    pushScope(name) {
        this._scopeStack.push(name);
    }
    popScope() {
        if (this._scopeStack.length > 1) this._scopeStack.pop();
    }

    setEnabled(v) { this._enabled = !!v; }
}

export const shortcuts = new ShortcutManager();

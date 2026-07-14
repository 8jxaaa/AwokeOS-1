/**
 * Calculator — basic and scientific modes.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';

export default {
    id: 'calculator',
    name: 'Calculator',
    icon: 'calculator',
    category: 'Utilities',
    description: 'Perform calculations',
    defaultSize: { width: 320, height: 480 },
    minSize: { width: 280, height: 400 },

    async render() {
        const root = h('div', { class: 'app-root calc-root' });

        // Mode toggle
        let mode = 'basic'; // 'basic' | 'scientific'
        const display = h('div', { class: 'calc-display' });
        const exprDisplay = h('div', { class: 'calc-expr' }, '');
        const valDisplay = h('div', { class: 'calc-val' }, '0');
        display.appendChild(exprDisplay);
        display.appendChild(valDisplay);

        // Keypad
        const keypad = h('div', { class: 'calc-keypad' });

        // State
        let current = '0';
        let previous = null;
        let op = null;
        let resetNext = false;
        let expression = '';
        let memory = 0;

        function updateDisplay() {
            exprDisplay.textContent = expression;
            valDisplay.textContent = current.length > 14 ? Number(current).toExponential(7) : current;
        }

        function inputDigit(d) {
            if (resetNext) { current = '0'; resetNext = false; }
            if (current === '0' && d !== '.') current = d;
            else if (d === '.' && current.includes('.')) return;
            else current += d;
            updateDisplay();
        }

        function inputOp(o) {
            if (previous !== null && op && !resetNext) {
                compute();
            } else {
                previous = parseFloat(current);
            }
            op = o;
            resetNext = true;
            expression = `${previous} ${o}`;
            updateDisplay();
        }

        function compute() {
            if (previous === null || op === null) return;
            const cur = parseFloat(current);
            let result;
            switch (op) {
                case '+': result = previous + cur; break;
                case '-': result = previous - cur; break;
                case '×': result = previous * cur; break;
                case '÷': result = cur === 0 ? NaN : previous / cur; break;
                case '%': result = previous % cur; break;
                case '^': result = Math.pow(previous, cur); break;
                default: result = cur;
            }
            expression = `${previous} ${op} ${cur} =`;
            current = String(roundTo(result, 12));
            previous = null;
            op = null;
            resetNext = true;
            updateDisplay();
        }

        function clear() {
            current = '0'; previous = null; op = null;
            expression = ''; resetNext = false;
            updateDisplay();
        }

        function backspace() {
            if (resetNext) return;
            current = current.length > 1 ? current.slice(0, -1) : '0';
            updateDisplay();
        }

        function applyUnary(fn, label) {
            const v = parseFloat(current);
            const r = fn(v);
            expression = `${label}(${v})`;
            current = String(roundTo(r, 12));
            resetNext = true;
            updateDisplay();
        }

        function key(label, opts = {}) {
            const k = h('button', {
                class: `calc-key ${opts.type || ''}`,
                style: opts.style || {},
                onClick: opts.onClick
            }, label);
            return k;
        }

        function renderBasic() {
            keypad.innerHTML = '';
            const rows = [
                [{ label: 'AC', type: 'fn', onClick: clear }, { label: '±', type: 'fn', onClick: () => { current = String(-parseFloat(current)); updateDisplay(); } }, { label: '%', type: 'fn', onClick: () => inputOp('%') }, { label: '÷', type: 'op', onClick: () => inputOp('÷') }],
                [{ label: '7', onClick: () => inputDigit('7') }, { label: '8', onClick: () => inputDigit('8') }, { label: '9', onClick: () => inputDigit('9') }, { label: '×', type: 'op', onClick: () => inputOp('×') }],
                [{ label: '4', onClick: () => inputDigit('4') }, { label: '5', onClick: () => inputDigit('5') }, { label: '6', onClick: () => inputDigit('6') }, { label: '-', type: 'op', onClick: () => inputOp('-') }],
                [{ label: '1', onClick: () => inputDigit('1') }, { label: '2', onClick: () => inputDigit('2') }, { label: '3', onClick: () => inputDigit('3') }, { label: '+', type: 'op', onClick: () => inputOp('+') }],
                [{ label: '0', onClick: () => inputDigit('0'), style: { gridColumn: 'span 2' } }, { label: '.', onClick: () => inputDigit('.') }, { label: '=', type: 'eq', onClick: compute }]
            ];
            for (const row of rows) {
                const r = h('div', { class: 'calc-row' });
                for (const k of row) r.appendChild(key(k.label, k));
                keypad.appendChild(r);
            }
        }

        function renderScientific() {
            keypad.innerHTML = '';
            const sciKeys = [
                [{ label: 'sin', fn: () => applyUnary(Math.sin, 'sin') }, { label: 'cos', fn: () => applyUnary(Math.cos, 'cos') }, { label: 'tan', fn: () => applyUnary(Math.tan, 'tan') }, { label: 'π', fn: () => { current = String(Math.PI); resetNext = true; updateDisplay(); } }],
                [{ label: 'asin', fn: () => applyUnary(Math.asin, 'asin') }, { label: 'acos', fn: () => applyUnary(Math.acos, 'acos') }, { label: 'atan', fn: () => applyUnary(Math.atan, 'atan') }, { label: 'e', fn: () => { current = String(Math.E); resetNext = true; updateDisplay(); } }],
                [{ label: 'ln', fn: () => applyUnary(Math.log, 'ln') }, { label: 'log', fn: () => applyUnary(Math.log10, 'log') }, { label: '√', fn: () => applyUnary(Math.sqrt, '√') }, { label: 'x²', fn: () => applyUnary(x => x*x, 'sqr') }],
                [{ label: 'xʸ', fn: () => inputOp('^') }, { label: '1/x', fn: () => applyUnary(x => 1/x, '1/') }, { label: 'n!', fn: () => applyUnary(factorial, '!') }, { label: '|x|', fn: () => applyUnary(Math.abs, 'abs') }]
            ];
            const wrap = h('div', { class: 'calc-sci-keys' });
            for (const row of sciKeys) {
                const r = h('div', { class: 'calc-row' });
                for (const k of row) {
                    r.appendChild(key(k.label, { type: 'fn', onClick: k.fn }));
                }
                wrap.appendChild(r);
            }
            keypad.appendChild(wrap);

            const rows = [
                [{ label: 'AC', type: 'fn', onClick: clear }, { label: '±', type: 'fn', onClick: () => { current = String(-parseFloat(current)); updateDisplay(); } }, { label: '%', type: 'fn', onClick: () => inputOp('%') }, { label: '÷', type: 'op', onClick: () => inputOp('÷') }],
                [{ label: '7', onClick: () => inputDigit('7') }, { label: '8', onClick: () => inputDigit('8') }, { label: '9', onClick: () => inputDigit('9') }, { label: '×', type: 'op', onClick: () => inputOp('×') }],
                [{ label: '4', onClick: () => inputDigit('4') }, { label: '5', onClick: () => inputDigit('5') }, { label: '6', onClick: () => inputDigit('6') }, { label: '-', type: 'op', onClick: () => inputOp('-') }],
                [{ label: '1', onClick: () => inputDigit('1') }, { label: '2', onClick: () => inputDigit('2') }, { label: '3', onClick: () => inputDigit('3') }, { label: '+', type: 'op', onClick: () => inputOp('+') }],
                [{ label: '0', onClick: () => inputDigit('0'), style: { gridColumn: 'span 2' } }, { label: '.', onClick: () => inputDigit('.') }, { label: '=', type: 'eq', onClick: compute }]
            ];
            for (const row of rows) {
                const r = h('div', { class: 'calc-row' });
                for (const k of row) r.appendChild(key(k.label, k));
                keypad.appendChild(r);
            }
        }

        function factorial(n) {
            if (n < 0 || !Number.isInteger(n)) return NaN;
            if (n > 170) return Infinity;
            let r = 1;
            for (let i = 2; i <= n; i++) r *= i;
            return r;
        }

        function roundTo(n, digits) {
            if (!isFinite(n)) return String(n);
            const f = Math.pow(10, digits);
            return String(Math.round(n * f) / f);
        }

        // Mode toggle
        const modeBtn = h('button', {
            class: 'btn btn-sm',
            onClick: () => {
                mode = mode === 'basic' ? 'scientific' : 'basic';
                modeBtn.textContent = mode === 'basic' ? 'Scientific' : 'Basic';
                if (mode === 'basic') renderBasic();
                else renderScientific();
            }
        }, 'Scientific');

        // Memory buttons
        const memRow = h('div', { class: 'calc-mem-row' }, [
            h('button', { class: 'calc-key fn', onClick: () => { memory = 0; } }, 'MC'),
            h('button', { class: 'calc-key fn', onClick: () => { memory = parseFloat(current); } }, 'MS'),
            h('button', { class: 'calc-key fn', onClick: () => { current = String(memory); updateDisplay(); } }, 'MR'),
            h('button', { class: 'calc-key fn', onClick: () => { current = String(memory); updateDisplay(); } }, 'M+'),
            modeBtn
        ]);

        // Keyboard
        const kbd = (e) => {
            if (!root.isConnected) return;
            if (/[0-9.]/.test(e.key)) inputDigit(e.key);
            else if (e.key === '+' || e.key === '-') inputOp(e.key);
            else if (e.key === '*') inputOp('×');
            else if (e.key === '/') { e.preventDefault(); inputOp('÷'); }
            else if (e.key === '%') inputOp('%');
            else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); compute(); }
            else if (e.key === 'Escape') clear();
            else if (e.key === 'Backspace') backspace();
        };
        document.addEventListener('keydown', kbd);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                document.removeEventListener('keydown', kbd);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        root.appendChild(display);
        root.appendChild(memRow);
        root.appendChild(keypad);
        renderBasic();
        updateDisplay();
        return root;
    }
};

/**
 * DOM utilities — tiny helpers that don't replace the DOM API but smooth common tasks.
 */

/**
 * Create an element with attributes and children.
 * @param {string} tag
 * @param {Object} [attrs] - Map of attribute/value. Special keys: class, style, dataset, on*
 * @param {(Node|string|null)[]} [children]
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') {
            el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
        } else if (k === 'style' && typeof v === 'object') {
            Object.assign(el.style, v);
        } else if (k === 'dataset' && typeof v === 'object') {
            for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
        } else if (k.startsWith('on') && typeof v === 'function') {
            el.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'html') {
            el.innerHTML = v;
        } else if (k === 'text') {
            el.textContent = v;
        } else if (v === true) {
            el.setAttribute(k, '');
        } else {
            el.setAttribute(k, v);
        }
    }
    appendChildren(el, children);
    return el;
}

function appendChildren(el, children) {
    if (children == null) return;
    if (!Array.isArray(children)) children = [children];
    for (const c of children) {
        if (c == null || c === false) continue;
        if (c instanceof Node) el.appendChild(c);
        else el.appendChild(document.createTextNode(String(c)));
    }
}

/**
 * Query single element (scoped to root if given).
 */
export function $(selector, root = document) {
    return root.querySelector(selector);
}
export function $$(selector, root = document) {
    return [...root.querySelectorAll(selector)];
}

/**
 * Remove element with optional animation.
 */
export function removeEl(el, animation = null) {
    if (!el || !el.parentNode) return Promise.resolve();
    if (animation) {
        return new Promise((resolve) => {
            el.classList.add(animation);
            const done = () => { el.parentNode?.removeChild(el); resolve(); };
            el.addEventListener('animationend', done, { once: true });
            setTimeout(done, 500); // safety
        });
    }
    el.parentNode.removeChild(el);
    return Promise.resolve();
}

/**
 * Empty an element.
 */
export function clear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Add CSS to document once by id.
 */
export function injectCSS(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
}

/**
 * Mount an element into a target.
 */
export function mount(target, el) {
    if (typeof target === 'string') target = $(target);
    if (!target) return;
    target.appendChild(el);
}

/**
 * Wait for next frame.
 */
export function nextFrame() {
    return new Promise((r) => requestAnimationFrame(() => r()));
}

/**
 * Wait for ms.
 */
export function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Detect touch device.
 */
export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Detect mobile width.
 */
export function isMobile() {
    return window.matchMedia('(max-width: 640px)').matches;
}

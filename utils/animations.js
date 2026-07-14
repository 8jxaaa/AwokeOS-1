/**
 * Animation utilities — requestAnimationFrame helpers for smooth, efficient motion.
 */

/**
 * Run a callback over time using requestAnimationFrame.
 * Returns a control object with cancel().
 */
export function animate({ duration = 300, easing = easeOutCubic, onUpdate, onComplete }) {
    const start = performance.now();
    let raf = 0;
    let cancelled = false;
    function frame(now) {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / duration);
        const v = easing(t);
        onUpdate?.(v, t);
        if (t < 1) raf = requestAnimationFrame(frame);
        else onComplete?.();
    }
    raf = requestAnimationFrame(frame);
    return {
        cancel() { cancelled = true; cancelAnimationFrame(raf); }
    };
}

/* Easings */
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
export const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeSpring = (t) => {
    // simple spring approximation
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * (2 * Math.PI) / 3);
};

/**
 * Debounce — delays fn execution until idle for `wait` ms.
 */
export function debounce(fn, wait = 200) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Throttle — limits invocations to at most once per `wait` ms.
 */
export function throttle(fn, wait = 100) {
    let last = 0;
    let timer;
    return function (...args) {
        const now = Date.now();
        const remaining = wait - (now - last);
        if (remaining <= 0) {
            clearTimeout(timer);
            last = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

/**
 * requestAnimationFrame throttle.
 */
export function rafThrottle(fn) {
    let queued = false;
    let lastArgs;
    return function (...args) {
        lastArgs = args;
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            fn.apply(this, lastArgs);
        });
    };
}

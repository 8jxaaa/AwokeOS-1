/**
 * Notification service — toast popups, persisted notification center, native Notification API.
 */
import { bus, EVENTS } from '../core/event-bus.js';
import { h, removeEl, wait, nextFrame } from '../utils/dom.js';
import { uid } from '../utils/id.js';
import { getState } from '../core/state-manager.js';
import { settings } from './persistence-service.js';

class NotificationService {
    constructor() {
        this.toastContainer = null;
        this.notifList = null;
        this.notifCenterRoot = null;
        this.persisted = settings.get('notifications', []);
        this._init();
        this._cleanupTimer = null;
    }

    _init() {
        // Lazy-init DOM hooks
        bus.on(EVENTS.TOAST, (opts) => this.toast(opts));
        bus.on(EVENTS.NOTIFICATION, (opts) => this.notify(opts));
        bus.on(EVENTS.NOTIF_TOGGLE, () => this.toggleCenter());
        document.addEventListener('DOMContentLoaded', () => {
            this.toastContainer = document.getElementById('toast-container');
            this.notifCenterRoot = document.getElementById('notification-center-root');
        });
        // Close notification center when other overlays open
        bus.on('overlay:open', (name) => {
            if (name !== 'notif-center' && this.notifCenterRoot?.classList.contains('open')) {
                this.toggleCenter();
            }
        });
    }

    /** Toast — ephemeral bottom-center popups. */
    async toast({ title, message, type = 'info', duration = 3000, icon = null } = {}) {
        if (!this.toastContainer) return;
        const state = getState();
        if (!state.get('notificationsEnabled')) return;

        const el = h('div', { class: ['toast', type], role: 'status' }, [
            icon && h('span', { class: 'toast-icon', html: icon }),
            h('div', { class: 'flex flex-col gap-1' }, [
                title && h('div', { class: 'font-bold text-sm' }, title),
                message && h('div', { class: 'text-sm text-secondary' }, message)
            ])
        ]);
        this.toastContainer.appendChild(el);
        await wait(duration);
        el.classList.add('fade-out');
        await wait(250);
        await removeEl(el);
    }

    /** Notification — top-right cards + center entry. */
    notify({ id, title, message, icon = null, appId = 'system', duration = 5000, onClick = null } = {}) {
        const state = getState();
        if (!state.get('notificationsEnabled') || state.get('doNotDisturb')) return;

        const nid = id || uid('notif');
        // Top-right toast
        const el = h('div', { class: 'notification', role: 'alert', dataset: { id: nid } }, [
            h('div', { class: 'notification-icon', html: icon || defaultIcon() }),
            h('div', { class: 'notification-content' }, [
                h('div', { class: 'notification-title' }, title || 'Notification'),
                h('div', { class: 'notification-message' }, message || '')
            ])
        ]);
        const root = document.getElementById('notifications');
        if (root) {
            root.appendChild(el);
            el.addEventListener('click', () => {
                onClick?.();
                el.classList.add('fade-out');
                setTimeout(() => removeEl(el), 250);
            });
            setTimeout(() => {
                el.classList.add('fade-out');
                setTimeout(() => removeEl(el), 250);
            }, duration);
        }

        // Persist in center
        const item = { id: nid, title, message, icon, appId, time: Date.now() };
        this.persisted.unshift(item);
        if (this.persisted.length > 50) this.persisted.length = 50;
        settings.set('notifications', this.persisted);
        this.renderCenter();
    }

    renderCenter() {
        if (!this.notifCenterRoot) return;
        this.notifCenterRoot.innerHTML = '';
        if (this.persisted.length === 0) {
            const empty = h('div', { class: 'notif-center-empty' }, 'No notifications yet');
            this.notifCenterRoot.appendChild(empty);
            return;
        }
        for (const n of this.persisted) {
            const el = h('div', { class: 'notification', dataset: { id: n.id } }, [
                h('div', { class: 'notification-icon', html: n.icon || defaultIcon() }),
                h('div', { class: 'notification-content' }, [
                    h('div', { class: 'notification-title' }, n.title),
                    h('div', { class: 'notification-message' }, n.message)
                ])
            ]);
            el.addEventListener('click', () => {
                bus.emit('app:open', n.appId);
                this.dismiss(n.id);
            });
            this.notifCenterRoot.appendChild(el);
        }
    }

    dismiss(id) {
        this.persisted = this.persisted.filter(n => n.id !== id);
        settings.set('notifications', this.persisted);
        this.renderCenter();
    }

    clearAll() {
        this.persisted = [];
        settings.set('notifications', []);
        this.renderCenter();
    }

    toggleCenter() {
        const root = this.notifCenterRoot;
        if (!root) return;
        const isOpen = root.querySelector('.notif-center');
        if (isOpen) {
            root.innerHTML = '';
            bus.emit('overlay:close', 'notification-center');
        } else {
            this.renderCenter();
            const panel = h('div', { class: 'notif-center' }, [
                h('div', { class: 'notif-center-header' }, [
                    h('h3', {}, 'Notifications'),
                    h('div', { class: 'notif-center-clear', onClick: () => this.clearAll() }, 'Clear all')
                ]),
                h('div', { class: 'notif-center-list' }, [
                    ...this.notifCenterRoot.querySelectorAll('.notification')
                ])
            ]);
            root.innerHTML = '';
            root.appendChild(panel);
            bus.emit('overlay:open', 'notification-center');
        }
    }
}

function defaultIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
}

let _instance = null;
export function getNotificationService() {
    if (!_instance) _instance = new NotificationService();
    return _instance;
}

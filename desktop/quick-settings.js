/**
 * Quick Settings — quick toggles panel (WiFi, Bluetooth, DND, Theme, etc).
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { getState } from '../core/state-manager.js';
import { icon } from '../assets/icons.js';
import { h } from '../utils/dom.js';

let _panel = null;

class QuickSettingsPanel {
    constructor() {
        this.state = {
            wifi: true,
            bluetooth: false,
            dnd: false,
            nightLight: false,
            airplane: false,
            theme: 'dark',
            volume: 70,
            brightness: 100
        };
    }
    static getInstance() {
        if (!QuickSettingsPanel._instance) QuickSettingsPanel._instance = new QuickSettingsPanel();
        return QuickSettingsPanel._instance;
    }

    open() {
        if (_panel) return;
        // Close notification center if open
        bus.emit(EVENTS.NOTIF_CLOSE);
        this._syncFromState();
        this._render();
        bus.emit('overlay:open', 'quick-settings');
    }

    toggle() {
        if (_panel) this.close();
        else this.open();
    }

    close() {
        if (_panel) {
            _panel.remove();
            _panel = null;
        }
        bus.emit('overlay:close', 'quick-settings');
    }

    // Listen for other overlay openings to close this one
    bus.on('overlay:open', (name) => {
        if (name !== 'quick-settings' && _panel) {
            this.close();
        }
    });

    _syncFromState() {
        const state = getState();
        this.state.dnd = state.get('doNotDisturb');
        this.state.theme = state.get('theme');
        this.state.bluetooth = state.get('bluetooth');
        this.state.airplane = state.get('airplane');
        this.state.vpn = state.get('vpn');
        this.state.nightLight = state.get('nightLight');
    }

    _render() {
        const root = document.getElementById('quick-settings-root');
        if (!root) return;
        root.innerHTML = '';

        const tiles = [
            { key: 'wifi', label: 'Wi-Fi', iconKey: 'wifi', active: this.state.wifi, onClick: () => this._toggle('wifi') },
            { key: 'bluetooth', label: 'Bluetooth', iconKey: 'bluetooth', active: this.state.bluetooth, onClick: () => this._toggle('bluetooth') },
            { key: 'airplane', label: 'Airplane', iconKey: 'wifi', active: this.state.airplane, onClick: () => this._toggle('airplane') },
            { key: 'dnd', label: 'Do Not Disturb', iconKey: 'bell', active: this.state.dnd, onClick: () => this._toggle('dnd') },
            { key: 'nightLight', label: 'Night Light', iconKey: 'moon', active: this.state.nightLight, onClick: () => this._toggle('nightLight') },
            { key: 'theme', label: this.state.theme === 'dark' ? 'Dark' : 'Light', iconKey: this.state.theme === 'dark' ? 'moon' : 'sun', active: true, onClick: () => this._cycleTheme() }
        ];

        const tileEls = tiles.map(t => h('button', {
            class: ['qs-tile', t.active ? 'active' : ''],
            onClick: t.onClick
        }, [
            h('span', { html: icon(t.iconKey) }),
            h('span', {}, t.label)
        ]));

        _panel = h('div', { class: 'quick-settings', onClick: (e) => e.stopPropagation() }, [
            h('div', { class: 'qs-tiles' }, tileEls),
            h('div', { class: 'qs-row' }, [
                h('div', { class: 'qs-row-label' }, [
                    h('span', { html: icon('volume-2') }),
                    'Volume'
                ]),
                h('input', { class: 'qs-slider', type: 'range', min: '0', max: '100', value: this.state.volume, onInput: (e) => this.state.volume = +e.target.value })
            ]),
            h('div', { class: 'qs-row' }, [
                h('div', { class: 'qs-row-label' }, [
                    h('span', { html: icon('sun') }),
                    'Brightness'
                ]),
                h('input', { class: 'qs-slider', type: 'range', min: '20', max: '100', value: this.state.brightness, onInput: (e) => {
                    this.state.brightness = +e.target.value;
                    document.body.style.filter = `brightness(${0.2 + (this.state.brightness/100)*0.8})`;
                }})
            ]),
            h('div', { class: 'qs-row' }, [
                h('div', { class: 'qs-row-label' }, [
                    h('span', { html: icon('battery') }),
                    'Battery'
                ]),
                h('div', { class: 'text-sm text-secondary' }, this._batteryStatus())
            ]),
            h('div', { class: 'flex gap-2 mt-2' }, [
                h('button', { class: 'btn flex-1', onClick: () => { this.close(); bus.emit(EVENTS.APP_OPENED, { id: 'settings' }); } }, 'All settings'),
                h('button', { class: 'btn btn-primary flex-1', onClick: () => this.close() }, 'Done')
            ])
        ]);

        root.appendChild(_panel);
        requestAnimationFrame(() => {
            if (_panel) _panel.classList.add('open');
        });

        // Close on outside click
        setTimeout(() => {
            const onDoc = (e) => {
                if (!_panel) return;
                if (!_panel.contains(e.target) && !e.target.closest('#quick-settings-btn')) {
                    this.close();
                    document.removeEventListener('mousedown', onDoc);
                }
            };
            document.addEventListener('mousedown', onDoc);
        }, 0);
    }

    _toggle(key) {
        this.state[key] = !this.state[key];
        if (key === 'dnd') {
            getState().set('doNotDisturb', this.state.dnd);
        }
        this._render();
    }

    _cycleTheme() {
        const order = ['dark', 'light', 'amoled'];
        const cur = getState().get('theme');
        const next = order[(order.indexOf(cur) + 1) % order.length];
        bus.emit('theme:set', next);
        this.state.theme = next;
        this._render();
    }

    _batteryStatus() {
        if (navigator.getBattery) {
            navigator.getBattery().then(b => {
                const txt = `${Math.round(b.level * 100)}%`;
                if (_panel) {
                    const el = _panel.querySelector('.battery-text');
                    if (el) el.innerHTML = `${txt} ${b.charging ? icon('charging') : ''}`;
                }
            }).catch(() => {});
        }
        return '—';
    }
}

export const QuickSettings = QuickSettingsPanel;
bus.on(EVENTS.QUICK_SETTINGS_TOGGLE, () => QuickSettings.getInstance().toggle());

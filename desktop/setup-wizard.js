/**
 * First-boot setup wizard — quick setup for new users.
 * Shows on first boot: username, password, preferences, predownload apps.
 */

import { bus, EVENTS } from '../core/event-bus.js';
import { getState } from '../core/state-manager.js';
import { h } from '../utils/dom.js';
import { getThemeService } from '../services/theme-service.js';
import { getAppRegistry } from '../core/app-registry.js';

export function showSetupWizard() {
    const state = getState();
    if (!state.get('firstBoot')) return; // only once

    // Step 1: Welcome
    const welcome = h('div', { class: 'setup-overlay', style: {
        position: 'fixed', inset: '0', zIndex: '2147483647',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)'
    }});
    const step1 = h('div', { class: 'setup-dialog', style: {
        background: 'var(--bg-elevated)', borderRadius: '12px', padding: '32px',
        maxWidth: '480px', width: '90%', boxShadow: '0 32px 64px rgba(0,0,0,.5)',
        textAlign: 'center'
    }}, [
        h('h2', { style: { fontSize: '20px', marginBottom: '16px' } }, 'Welcome to AwokeOS'),
        h('p', { style: { fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' } }, 'This is your first time using this OS. Would you like to have a quick setup?'),
        h('div', { style: { display: 'flex', gap: '12px', justifyContent: 'center' } }, [
            h('button', { class: 'btn btn-primary', style: { padding: '8px 24px' }, onClick: () => {
                welcome.remove();
                showShutdownConfirm();
            } }, 'Yes'),
            h('button', { class: 'btn', style: { padding: '8px 24px' }, onClick: () => {
                welcome.remove();
                state.set('firstBoot', false);
            } }, 'Cancel')
        ])
    ]);
    welcome.appendChild(step1);
    document.body.appendChild(welcome);
}

function showShutdownConfirm() {
    const overlay = h('div', { class: 'setup-overlay', style: {
        position: 'fixed', inset: '0', zIndex: '2147483647',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)'
    }});
    const dialog = h('div', { class: 'setup-dialog', style: {
        background: 'var(--bg-elevated)', borderRadius: '12px', padding: '32px',
        maxWidth: '480px', width: '90%', boxShadow: '0 32px 64px rgba(0,0,0,.5)',
        textAlign: 'center'
    }}, [
        h('h2', { style: { fontSize: '20px', marginBottom: '16px' } }, 'This may proceed a shutdown.'),
        h('p', { style: { fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' } }, 'Would you like to continue?'),
        h('div', { style: { display: 'flex', gap: '12px', justifyContent: 'center' } }, [
            h('button', { class: 'btn btn-danger', style: { padding: '8px 24px' }, onClick: () => {
                overlay.remove();
                // Fade to black
                const blackout = document.createElement('div');
                blackout.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:black;transition:opacity 1s;opacity:0';
                document.body.appendChild(blackout);
                requestAnimationFrame(() => blackout.style.opacity = '1');
                setTimeout(() => {
                    blackout.style.opacity = '0';
                    setTimeout(() => {
                        blackout.remove();
                        showSetupForm();
                    }, 300);
                }, 1000);
            } }, 'Yes, continue'),
            h('button', { class: 'btn', style: { padding: '8px 24px' }, onClick: () => {
                overlay.remove();
            } }, 'Cancel')
        ])
    ]);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

function showSetupForm() {
    const state = getState();
    const overlay = h('div', { class: 'setup-overlay', style: {
        position: 'fixed', inset: '0', zIndex: '2147483647',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)',
        overflow: 'auto'
    }});
    const form = h('div', { class: 'setup-dialog', style: {
        background: 'var(--bg-elevated)', borderRadius: '12px', padding: '32px',
        maxWidth: '520px', width: '90%', boxShadow: '0 32px 64px rgba(0,0,0,.5)',
        maxHeight: '90vh', overflow: 'auto'
    }}, [
        h('h2', { style: { fontSize: '20px', marginBottom: '16px' } }, 'Quick Setup'),
        h('p', { style: { fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' } }, 'Configure your AwokeOS experience'),
        // Username
        h('div', { style: { marginBottom: '16px' } }, [
            h('label', { style: { display: 'block', marginBottom: '6px', fontWeight: '600' } }, 'Username'),
            h('input', { type: 'text', id: 'setup-username', class: 'input', style: { width: '100%' }, value: state.get('username') || 'User' })
        ]),
        // Password
        h('div', { style: { marginBottom: '16px' } }, [
            h('label', { style: { display: 'block', marginBottom: '6px', fontWeight: '600' } }, 'Password (optional)'),
            h('div', { style: { display: 'flex', gap: '8px' } }, [
                h('input', { type: 'password', id: 'setup-pass', class: 'input', style: { width: '100%' }, placeholder: 'Password...' }),
                h('select', { id: 'setup-pass-type', style: { width: '100px' } }, [
                    h('option', { value: 'word' }, 'Word'),
                    h('option', { value: '4-digit' }, '4-digit'),
                    h('option', { value: '6-digit' }, '6-digit'),
                    h('option', { value: 'text' }, 'Text')
                ])
            ])
        ]),
        // Preferences
        h('div', { style: { marginBottom: '16px' } }, [
            h('label', { style: { display: 'block', marginBottom: '6px', fontWeight: '600' } }, 'Preferences'),
            h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, [
                h('label', {}, [
                    h('input', { type: 'checkbox', id: 'pref-accents', checked: true }),
                    ' Show accent colors'
                ]),
                h('label', {}, [
                    h('input', { type: 'checkbox', id: 'pref-animations', checked: true }),
                    ' Enable animations'
                ]),
                h('label', {}, [
                    h('input', { type: 'checkbox', id: 'pref-blur', checked: true }),
                    ' Enable blur effects'
                ])
            ])
        ]),
        // Performance
        h('div', { style: { marginBottom: '16px' } }, [
            h('label', { style: { display: 'block', marginBottom: '6px', fontWeight: '600' } }, 'Performance mode'),
            h('select', { id: 'setup-perf', style: { width: '200px' } }, [
                h('option', { value: 'auto' }, 'Auto'),
                h('option', { value: 'high' }, 'High performance'),
                h('option', { value: 'low' }, 'Battery saver')
            ])
        ]),
        // Predownload apps
        h('div', { style: { marginBottom: '24px' } }, [
            h('label', { style: { display: 'block', marginBottom: '6px', fontWeight: '600' } }, 'Pre-download apps'),
            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
                h('label', {}, [h('input', { type: 'checkbox', id: 'pre-app-store' }), ' App Store']),
                h('label', {}, [h('input', { type: 'checkbox', id: 'pre-browser' }), ' Browser']),
                h('label', {}, [h('input', { type: 'checkbox', id: 'pre-calculator' }), ' Calculator']),
                h('label', {}, [h('input', { type: 'checkbox', id: 'pre-notes' }), ' Notes']),
                h('label', {}, [h('input', { type: 'checkbox', id: 'pre-paint' }), ' Paint']),
                h('label', {}, [h('input', { type: 'checkbox', id: 'pre-music' }), ' Music']),
                h('label', {}, [h('input', { type: 'checkbox', id: 'pre-terminal' }), ' Terminal'])
            ])
        ]),
        // Submit
        h('button', { class: 'btn btn-primary', style: { width: '100%', padding: '12px' }, onClick: () => {
            // Save settings
            const username = document.getElementById('setup-username')?.value || 'User';
            state.set('username', username);
            state.set('firstBoot', false);
            const perf = document.getElementById('setup-perf')?.value || 'auto';
            state.set('performance', perf);
            if (perf === 'low') {
                state.set('reduceMotion', true);
                state.set('transparency', 0.95);
                state.set('blurStrength', 0);
            }
            const pass = document.getElementById('setup-pass')?.value || '';
            if (pass) {
                state.set('password', pass);
                state.set('passwordType', document.getElementById('setup-pass-type')?.value || 'word');
            }
            const passType = document.getElementById('setup-pass-type')?.value || 'text';
            if (pass && passType === 'word' && pass.split(' ').length < 1) {
                alert('Password must be at least 1 word');
                return;
            }
            if (pass && (passType === '4-digit' || passType === '6-digit') && !/^\d+$/.test(pass)) {
                alert('Password must be numeric');
                return;
            }
            // Pre-download apps
            const preApps = [];
            ['app-store', 'browser', 'calculator', 'notes', 'paint', 'music', 'terminal'].forEach(id => {
                if (document.getElementById('pre-' + id)?.checked) preApps.push(id);
            });
            if (preApps.length) {
                const reg = getAppRegistry();
                reg.preload(preApps).then(() => {
                    state.set('preloadedApps', preApps);
                }).catch(() => {});
            }
            bus.emit(EVENTS.TOAST, { type: 'success', message: 'Setup complete!', duration: 3000 });
            overlay.remove();
            document.body.classList.remove('reduce-motion', 'no-blur');
            document.body.style.setProperty('--blur-strength', '0px');
        }}, 'Finish setup')
    ]);
    overlay.appendChild(form);
    document.body.appendChild(overlay);
}
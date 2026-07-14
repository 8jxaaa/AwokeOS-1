/**
 * Clock — world clock, stopwatch, timer.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { appData } from '../../services/persistence-service.js';
import { bus, EVENTS } from '../../core/event-bus.js';

export default {
    id: 'clock',
    name: 'Clock',
    icon: 'clock',
    category: 'Productivity',
    description: 'World clock, stopwatch and timer',
    defaultSize: { width: 700, height: 540 },
    minSize: { width: 360, height: 360 },

    async render() {
        const root = h('div', { class: 'app-root clock-root' });

        let tab = 'world'; // world, stopwatch, timer
        const display = h('div', { class: 'clock-display' });
        const content = h('div', { class: 'clock-content scroll-y' });

        const tabs = h('div', { class: 'clock-tabs' }, [
            h('button', { class: 'clock-tab active', dataset: { tab: 'world' }, onClick: () => switchTab('world') }, 'World clock'),
            h('button', { class: 'clock-tab', dataset: { tab: 'stopwatch' }, onClick: () => switchTab('stopwatch') }, 'Stopwatch'),
            h('button', { class: 'clock-tab', dataset: { tab: 'timer' }, onClick: () => switchTab('timer') }, 'Timer')
        ]);

        const layout = h('div', { class: 'clock-layout' }, [
            h('div', { class: 'clock-side' }, [
                display,
                tabs,
                content
            ])
        ]);
        root.appendChild(layout);

        function switchTab(name) {
            tab = name;
            for (const t of tabs.querySelectorAll('.clock-tab')) t.classList.toggle('active', t.dataset.tab === name);
            render();
        }

        // World clock
        const cities = appData.get('clock', 'cities', [
            { name: 'Local', tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
            { name: 'New York', tz: 'America/New_York' },
            { name: 'London', tz: 'Europe/London' },
            { name: 'Tokyo', tz: 'Asia/Tokyo' }
        ]);

        function renderWorld() {
            const now = new Date();
            display.innerHTML = '';
            display.appendChild(h('div', { class: 'clock-time-big' }, now.toLocaleTimeString()));
            display.appendChild(h('div', { class: 'clock-date-big' }, now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })));

            content.innerHTML = '';
            for (const c of cities) {
                const time = new Date().toLocaleTimeString('en-US', { timeZone: c.tz, hour: '2-digit', minute: '2-digit', hour12: false });
                const date = new Date().toLocaleDateString('en-US', { timeZone: c.tz, weekday: 'short', month: 'short', day: 'numeric' });
                content.appendChild(h('div', { class: 'clock-city' }, [
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'font-bold' }, c.name),
                        h('div', { class: 'text-sm text-secondary' }, date)
                    ]),
                    h('div', { class: 'clock-city-time' }, time)
                ]));
            }
        }

        // Stopwatch
        let swRunning = false;
        let swStart = 0;
        let swElapsed = 0;
        let swInterval = null;

        function fmtTime(ms) {
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            const cs = Math.floor((ms % 1000) / 10);
            return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
        }

        function renderStopwatch() {
            display.innerHTML = '';
            display.appendChild(h('div', { class: 'clock-time-big' }, fmtTime(swElapsed)));
            content.innerHTML = '';
            content.appendChild(h('div', { class: 'flex gap-2 justify-center' }, [
                h('button', { class: 'btn btn-primary', onClick: swToggle }, swRunning ? 'Stop' : (swElapsed > 0 ? 'Resume' : 'Start')),
                h('button', { class: 'btn', onClick: swReset, disabled: swElapsed === 0 ? 'disabled' : null }, 'Reset'),
                h('button', { class: 'btn', onClick: () => navigator.clipboard?.writeText(fmtTime(swElapsed)) }, 'Copy')
            ]));
        }

        function swToggle() {
            if (swRunning) {
                swRunning = false;
                swElapsed += Date.now() - swStart;
                clearInterval(swInterval);
            } else {
                swRunning = true;
                swStart = Date.now();
                swInterval = setInterval(() => {
                    const e = swElapsed + (Date.now() - swStart);
                    const t = display.querySelector('.clock-time-big');
                    if (t) t.textContent = fmtTime(e);
                }, 50);
            }
            renderStopwatch();
        }

        function swReset() {
            swRunning = false;
            swElapsed = 0;
            clearInterval(swInterval);
            renderStopwatch();
        }

        // Timer
        let timerSeconds = 0;
        let timerRunning = false;
        let timerInterval = null;
        let timerRemaining = 0;

        function renderTimer() {
            display.innerHTML = '';
            const m = Math.floor(timerRemaining / 60);
            const s = timerRemaining % 60;
            display.appendChild(h('div', { class: 'clock-time-big' }, `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`));
            content.innerHTML = '';
            content.appendChild(h('div', { class: 'flex flex-col gap-3' }, [
                h('div', { class: 'flex gap-2' }, [
                    h('input', { class: 'input', type: 'number', placeholder: 'Min', min: '0', max: '999', value: '5', id: 'timer-min', style: { width: '100px' } }),
                    h('input', { class: 'input', type: 'number', placeholder: 'Sec', min: '0', max: '59', value: '0', id: 'timer-sec', style: { width: '100px' } })
                ]),
                h('div', { class: 'flex gap-2 justify-center' }, [
                    h('button', { class: 'btn btn-primary', onClick: () => {
                        if (timerRunning) {
                            timerRunning = false;
                            clearInterval(timerInterval);
                            renderTimer();
                        } else {
                            const min = +document.getElementById('timer-min').value || 0;
                            const sec = +document.getElementById('timer-sec').value || 0;
                            timerRemaining = min * 60 + sec;
                            if (timerRemaining <= 0) return;
                            timerRunning = true;
                            timerInterval = setInterval(() => {
                                timerRemaining--;
                                if (timerRemaining <= 0) {
                                    clearInterval(timerInterval);
                                    timerRunning = false;
                                    bus.emit(EVENTS.NOTIFICATION, {
                                        title: 'Timer finished',
                                        message: 'Your countdown has ended.',
                                        appId: 'clock'
                                    });
                                    try { new AudioContext().resume(); } catch {}
                                }
                                renderTimer();
                            }, 1000);
                            renderTimer();
                        }
                    }}, timerRunning ? 'Stop' : 'Start'),
                    h('button', { class: 'btn', onClick: () => {
                        timerRunning = false;
                        clearInterval(timerInterval);
                        timerRemaining = 0;
                        renderTimer();
                    }}, 'Reset')
                ])
            ]));
        }

        function render() {
            if (tab === 'world') renderWorld();
            else if (tab === 'stopwatch') renderStopwatch();
            else if (tab === 'timer') renderTimer();
        }

        const updateInterval = setInterval(() => {
            if (tab === 'world') renderWorld();
            else if (tab === 'stopwatch' && swRunning) {
                const t = display.querySelector('.clock-time-big');
                if (t) t.textContent = fmtTime(swElapsed + (Date.now() - swStart));
            }
        }, 1000);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                clearInterval(updateInterval);
                clearInterval(swInterval);
                clearInterval(timerInterval);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        render();
        return root;
    }
};

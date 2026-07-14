/**
 * Calendar — month view with events.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { appData } from '../../services/persistence-service.js';
import { uid } from '../../utils/id.js';
import { bus, EVENTS } from '../../core/event-bus.js';

export default {
    id: 'calendar',
    name: 'Calendar',
    icon: 'calendar',
    category: 'Productivity',
    description: 'View and manage events',
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 400, height: 360 },

    async render() {
        const root = h('div', { class: 'app-root cal-root' });

        let viewDate = new Date();
        let events = appData.get('calendar', 'events', []) || [];
        let selectedDate = null;

        const monthLabel = h('div', { class: 'cal-month' });
        const grid = h('div', { class: 'cal-grid' });
        const eventList = h('div', { class: 'cal-events scroll-y' });

        const header = h('div', { class: 'cal-header' }, [
            h('div', { class: 'cal-nav' }, [
                h('button', { class: 'btn-icon', html: icon('chevron-left'), onClick: () => { viewDate.setMonth(viewDate.getMonth() - 1); render(); }}),
                monthLabel,
                h('button', { class: 'btn-icon', html: icon('chevron-right'), onClick: () => { viewDate.setMonth(viewDate.getMonth() + 1); render(); }})
            ]),
            h('button', { class: 'btn btn-sm', onClick: () => { viewDate = new Date(); render(); }}, 'Today'),
            h('div', { class: 'flex-1' }),
            h('button', { class: 'btn btn-primary btn-sm', onClick: addEvent }, [h('span', { html: icon('plus') }), 'New event'])
        ]);

        const layout = h('div', { class: 'cal-layout' }, [
            h('div', { class: 'cal-main' }, [header, grid]),
            h('div', { class: 'cal-side' }, [
                h('div', { class: 'cal-side-header' }, 'Events'),
                eventList
            ])
        ]);

        root.appendChild(layout);

        function render() {
            const y = viewDate.getFullYear();
            const m = viewDate.getMonth();
            monthLabel.textContent = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

            grid.innerHTML = '';
            // Day-of-week header
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            for (const d of days) grid.appendChild(h('div', { class: 'cal-dow' }, d));

            const firstDay = new Date(y, m, 1).getDay();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const today = new Date();
            const prevDays = new Date(y, m, 0).getDate();
            for (let i = 0; i < firstDay; i++) {
                const day = prevDays - firstDay + i + 1;
                grid.appendChild(h('div', { class: 'cal-day other-month' }, String(day)));
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(y, m, d);
                const isToday = date.toDateString() === today.toDateString();
                const dayEvents = events.filter(e => new Date(e.date).toDateString() === date.toDateString());
                const cell = h('div', {
                    class: ['cal-day', isToday ? 'today' : '', selectedDate && date.toDateString() === selectedDate.toDateString() ? 'selected' : ''],
                    onClick: () => { selectedDate = date; render(); }
                }, [
                    h('div', { class: 'cal-day-num' }, String(d)),
                    dayEvents.length ? h('div', { class: 'cal-day-dots' }, dayEvents.slice(0, 3).map(e => h('span', { style: { background: e.color || 'var(--accent)' } }))) : null
                ]);
                grid.appendChild(cell);
            }
            // Fill remaining cells
            const totalCells = firstDay + daysInMonth;
            const remain = (7 - (totalCells % 7)) % 7;
            for (let i = 1; i <= remain; i++) {
                grid.appendChild(h('div', { class: 'cal-day other-month' }, String(i)));
            }

            renderEventList();
        }

        function renderEventList() {
            eventList.innerHTML = '';
            const list = selectedDate
                ? events.filter(e => new Date(e.date).toDateString() === selectedDate.toDateString())
                : events.filter(e => new Date(e.date) >= new Date()).slice(0, 10);

            if (list.length === 0) {
                eventList.appendChild(h('div', { class: 'empty-state' }, [
                    h('div', { html: icon('calendar') }),
                    h('div', {}, 'No events')
                ]));
                return;
            }
            for (const ev of list) {
                const el = h('div', { class: 'cal-event' }, [
                    h('div', { class: 'cal-event-color', style: { background: ev.color || 'var(--accent)' } }),
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'cal-event-title' }, ev.title),
                        h('div', { class: 'cal-event-date' }, new Date(ev.date).toLocaleString())
                    ]),
                    h('button', { class: 'btn-icon', html: icon('trash'), onClick: (e) => { e.stopPropagation(); deleteEvent(ev.id); }})
                ]);
                eventList.appendChild(el);
            }
        }

        function addEvent() {
            const title = prompt('Event title:');
            if (!title) return;
            const date = selectedDate || new Date();
            const time = prompt('Time (HH:MM, blank for all-day):', '12:00');
            if (time) {
                const [h, m] = time.split(':').map(Number);
                date.setHours(h || 0, m || 0);
            }
            events.push({
                id: uid('ev'),
                title,
                date: date.toISOString(),
                color: ['#6366f1','#ec4899','#22c55e','#f97316','#06b6d4'][Math.floor(Math.random() * 5)]
            });
            appData.set('calendar', 'events', events);
            render();
        }

        function deleteEvent(id) {
            events = events.filter(e => e.id !== id);
            appData.set('calendar', 'events', events);
            render();
        }

        render();
        return root;
    }
};

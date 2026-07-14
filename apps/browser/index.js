/**
 * Browser — iframe-based browser.
 *
 * NOTE: Many sites block iframe embedding via X-Frame-Options. Users can still
 * navigate to less restrictive sites or use it for testing/demo. We also provide
 * a "new tab" page with quick links.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { bus, EVENTS } from '../../core/event-bus.js';

const HOME_URL = 'awokeos://home';

export default {
    id: 'browser',
    name: 'Browser',
    icon: 'browser',
    category: 'Internet',
    description: 'Browse the web',
    defaultSize: { width: 1000, height: 700 },
    minSize: { width: 400, height: 300 },

    async render({ args }) {
        const root = h('div', { class: 'app-root browser-root' });

        let history = [];
        let historyIdx = -1;
        let currentUrl = args?.url || HOME_URL;

        // Toolbar
        const backBtn = h('button', { class: 'btn-icon', html: icon('arrow-left'), onClick: goBack });
        const fwdBtn = h('button', { class: 'btn-icon', html: icon('arrow-right'), onClick: goForward });
        const refreshBtn = h('button', { class: 'btn-icon', html: icon('refresh'), onClick: () => load(currentUrl) });
        const homeBtn = h('button', { class: 'btn-icon', html: icon('home'), onClick: () => load(HOME_URL) });
        const urlInput = h('input', { class: 'input', type: 'text', placeholder: 'Enter URL or search…', onKeydown: (e) => {
            if (e.key === 'Enter') load(urlInput.value);
        }});
        const newTabBtn = h('button', { class: 'btn-icon', html: icon('plus'), title: 'New tab', onClick: () => bus.emit(EVENTS.APP_OPENED, { id: 'browser' }) });

        const toolbar = h('div', { class: 'app-toolbar' }, [
            backBtn, fwdBtn, refreshBtn, homeBtn,
            urlInput,
            newTabBtn
        ]);

        // Content
        const iframe = h('iframe', { class: 'browser-iframe', sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups', referrerpolicy: 'no-referrer' });
        const homePage = renderHomePage();

        const content = h('div', { class: 'browser-content' }, [iframe, homePage]);

        root.appendChild(toolbar);
        root.appendChild(content);

        function load(url) {
            if (!url) return;
            // History
            history = history.slice(0, historyIdx + 1);
            history.push(url);
            historyIdx = history.length - 1;

            if (url === HOME_URL) {
                iframe.style.display = 'none';
                homePage.style.display = '';
                urlInput.value = '';
            } else {
                homePage.style.display = 'none';
                iframe.style.display = '';
                // Normalize URL
                if (!/^https?:\/\//.test(url) && !url.startsWith('awokeos://')) {
                    // Treat as search
                    if (url.includes(' ') || !url.includes('.')) {
                        url = 'https://duckduckgo.com/?q=' + encodeURIComponent(url);
                    } else {
                        url = 'https://' + url;
                    }
                }
                urlInput.value = url;
                iframe.src = url;
            }
        }

        function goBack() {
            if (historyIdx > 0) {
                historyIdx--;
                load(history[historyIdx]);
            }
        }
        function goForward() {
            if (historyIdx < history.length - 1) {
                historyIdx++;
                load(history[historyIdx]);
            }
        }

        function renderHomePage() {
            const quickLinks = [
                { name: 'DuckDuckGo', url: 'https://duckduckgo.com', icon: 'search-web' },
                { name: 'Wikipedia', url: 'https://wikipedia.org', icon: 'book' },
                { name: 'Hacker News', url: 'https://news.ycombinator.com', icon: 'news' },
                { name: 'GitHub', url: 'https://github.com', icon: 'github' },
                { name: 'MDN', url: 'https://developer.mozilla.org', icon: 'code-docs' },
                { name: 'Open-Meteo', url: 'https://open-meteo.com', icon: 'weather-partly-cloudy' },
                { name: 'Example', url: 'https://example.com', icon: 'globe' },
                { name: 'HTTPBin', url: 'https://httpbin.org', icon: 'flask' }
            ];
            return h('div', { class: 'browser-home' }, [
                h('div', { class: 'browser-home-logo' }, [
                    h('svg', { viewBox: '0 0 64 64', width: '64', height: '64', html: `
                        <defs><linearGradient id="hg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient></defs>
                        <rect width="64" height="64" rx="14" fill="url(#hg)"/>
                        <text x="32" y="44" font-family="system-ui" font-size="34" font-weight="700" text-anchor="middle" fill="white">A</text>
                    `}),
                    h('div', { class: 'browser-home-title' }, 'AwokeOS Browser'),
                    h('div', { class: 'browser-home-sub' }, 'Type a URL above or pick a quick link.')
                ]),
                h('div', { class: 'browser-quick-grid' }, quickLinks.map(l => h('button', {
                    class: 'browser-quick-link',
                    onClick: () => load(l.url)
                }, [
                    h('div', { class: 'browser-quick-emoji', html: icon(l.icon) }),
                    h('div', { class: 'browser-quick-name' }, l.name)
                ])))
            ]);
        }

        load(currentUrl);
        return root;
    }
};

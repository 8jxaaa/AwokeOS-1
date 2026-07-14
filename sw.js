/**
 * AwokeOS Service Worker
 * Cache-first strategy with network fallback. Provides offline support.
 */

const CACHE_NAME = 'awokeos-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './styles/reset.css',
    './styles/variables.css',
    './styles/animations.css',
    './styles/main.css',
    './themes/themes.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.warn('[SW] Some assets failed to cache:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (!req.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) {
                // Refresh in background
                fetch(req).then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
                    }
                }).catch(() => {});
                return cached;
            }
            return fetch(req).then((res) => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
                }
                return res;
            }).catch(() => {
                // Fallback to index for navigations
                if (req.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Offline', { status: 503, statusText: 'Offline' });
            });
        })
    );
});

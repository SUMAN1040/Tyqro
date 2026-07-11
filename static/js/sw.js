const CACHE_NAME = 'tyqro-v1';
const OFFLINE_URL = '/';

const ASSETS_TO_CACHE = [
    '/',
    '/static/css/style.css',
    '/static/img/favicon.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Install service worker and cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activate event (clean up old caches)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event with Network-First strategy
self.addEventListener('fetch', event => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // If network request succeeds, clone response to cache for offline use
                if (networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails, try to return cached response
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If both fail and it's a page navigation, return the root offline landing page
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                });
            })
    );
});

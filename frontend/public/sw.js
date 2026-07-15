const CACHE_NAME = 'tyqro-v2';
const OFFLINE_URL = '/';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/favicon.png',
    '/favicon.svg',
    '/icons.svg'
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

    // Do not cache API endpoints or external scripts
    if (event.request.url.includes('/api/')) return;

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
                    // If both fail and it's a page navigation, return root index
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                });
            })
    );
});

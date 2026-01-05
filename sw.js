const CACHE = 'random-timer-v1';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            // Prefer cached, but update cache in background
            const fetchPromise = fetch(event.request)
                .then((resp) => {
                    const copy = resp.clone();
                    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
                    return resp;
                })
                .catch(() => cached);

            return cached || fetchPromise;
        })
    );
});

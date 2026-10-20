/**
 * Lina Manufacturing · Enterprise Stock Verification
 * Progressive Web Application (PWA) Service Worker
 */

const CACHE_NAME = 'lina-stock-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/lina-logo.png',
  '/manifest.webmanifest',
  '/vendor/lucide.min.js',
  '/vendor/xlsx.full.min.js',
  '/vendor/html5-qrcode.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Service Worker pre-caching warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch (_) {
    return;
  }

  // Strictly ignore non-http/https requests (e.g. chrome-extension://, moz-extension://, data:, blob:)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Network-only for API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Network offline. Operating in local cache mode.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first, network fallback for static resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        // Only cache http/https URLs
        if (event.request.url.startsWith('http://') || event.request.url.startsWith('https://')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          }).catch(() => {});
        }
        return networkResponse;
      }).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});

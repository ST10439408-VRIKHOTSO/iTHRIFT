'use strict';

/**
 * Minimal app-shell service worker. It caches the static mobile shell
 * (HTML, CSS, JS, icons) so the application opens even without a
 * connection, while every /api request always goes to the network -
 * the catalogue, cart and orders must never be served stale.
 */

const CACHE_NAME = 'ithrift-shell-v1';
const SHELL_FILES = [
  '/mobile/',
  '/mobile/index.html',
  '/mobile/css/style.css',
  '/mobile/js/app.js',
  '/mobile/manifest.json',
  '/mobile/icons/icon-192.png',
  '/mobile/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls - always go live to the shared database.
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET' && url.pathname.startsWith('/mobile')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match('/mobile/index.html'));
    })
  );
});

/* ============================================
   YouDash — Service Worker
   Кэширует интерфейс (CSS/JS/иконки).
   НЕ кэширует API и видео.
   ============================================ */

const CACHE_NAME = 'youdash-v2';
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/theme.css',
  './css/layout.css',
  './css/search.css',
  './css/player.css',
  './css/history.css',
  './css/related.css',
  './js/config.js',
  './js/storage.js',
  './js/theme.js',
  './js/api.js',
  './js/translate.js',
  './js/ui.js',
  './js/history.js',
  './js/related.js',
  './js/player.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Установка — кэшируем интерфейс
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_URLS).catch(function(err) {
        console.warn('SW: некоторые файлы не закэшированы', err);
      });
    })
  );
  self.skipWaiting();
});

// Активация — чистим старые версии кэша
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch — стратегия:
// - Для своих файлов (youdash) — cache-first
// - Для внешних (Piped, YouTube) — network-only
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Внешние запросы (API, видео) — только сеть
  if (url.origin !== location.origin) {
    return;
  }

  // Свои файлы — сначала кэш, потом сеть
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // Кэшируем только успешные GET-ответы
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }

        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseCopy);
        });
        return response;
      });
    }).catch(function() {
      // Если и кэша нет, и сеть упала — показываем index.html
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
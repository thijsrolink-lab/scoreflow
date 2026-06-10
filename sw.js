// ScoreFlow Service Worker
// Versie wordt verhoogd bij elke deployment om cache te verversen
var CACHE_VERSION = 'scoreflow-v1';
var STATIC_CACHE = CACHE_VERSION + '-static';
var SCORE_QUEUE_KEY = 'scoreflow-offline-queue';

// Bestanden die altijd gecached worden (app shell)
var APP_SHELL = [
  '/',
  '/index.html',
  '/leaderboard.html',
  '/manifest.json',
];

// ── Installatie: cache app shell ─────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() {
      return self.skipWaiting(); // Direct activeren
    })
  );
});

// ── Activatie: verwijder oude caches ─────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key.startsWith('scoreflow-') && key !== STATIC_CACHE;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim(); // Neem control over alle tabs
    })
  );
});

// ── Fetch: cache-first voor shell, network-first voor API ────
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Supabase API calls: altijd naar network, nooit cachen
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('anthropic.com') ||
      url.pathname.startsWith('/.netlify/functions/')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Supabase offline → return een leesbare fout
        return new Response(JSON.stringify({ error: 'offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      // Niet in cache: probeer network, sla op voor later
      return fetch(event.request).then(function(response) {
        // Sla succesvol response op in cache
        if (response && response.status === 200 && response.type === 'basic') {
          var cloned = response.clone();
          caches.open(STATIC_CACHE).then(function(cache) {
            cache.put(event.request, cloned);
          });
        }
        return response;
      }).catch(function() {
        // Offline en niet in cache: stuur fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── Background sync: verstuur gecachte scores als online ─────
self.addEventListener('sync', function(event) {
  if (event.tag === 'scoreflow-sync-scores') {
    event.waitUntil(syncOfflineScores());
  }
});

async function syncOfflineScores() {
  // Lees wachtrij uit IndexedDB (via postMessage naar client)
  var clients = await self.clients.matchAll();
  clients.forEach(function(client) {
    client.postMessage({ type: 'SW_SYNC_SCORES' });
  });
}

// ── Push notificaties (toekomstig) ───────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'ScoreFlow', {
      body: data.body || '',
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});

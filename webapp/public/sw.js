// Service worker

const CACHE = 'heart-monitor-v1';
const FILES = [
  'login.html', 'register.html', 'dashboard.html', 'patients.html', 'patient.html', 'my-health.html',
  'alerts.html', 'reports.html', 'admin.html', 'settings.html', 'offline.html',
  'css/style.css', 'js/common.js', 'js/chart.js', 'js/dashboard.js', 'js/patient.js', 'js/admin.js', 'js/user-form.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, cache when offline
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('offline.html');
        return Response.error();
      })
  );
});

// Alert notifications
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data.json(); } catch (err) { data = { title: 'Heart Monitor', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Heart Monitor alert', {
      body: data.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { url: data.url || '/alerts.html' },
    })
  );
});

// Open the app on tap
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const w = wins[0];
      if (w) return w.focus().then(() => w.navigate(url)).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    })
  );
});

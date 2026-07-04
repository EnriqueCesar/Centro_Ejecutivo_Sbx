const CACHE = 'centro-ejecutivo-fase4-2-kpi-dinamico-v1';
const ASSETS = ['./','index.html','assets/css/styles.css','assets/js/app.js','data/kpi-data.json','assets/img/centro-ejecutivo-logo.jpg'];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.mode === 'navigate' || req.url.includes('app.js') || req.url.includes('kpi-data.json')) {
    event.respondWith(fetch(req).catch(() => caches.match(req).then(r => r || caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(req).then(r => r || fetch(req)));
});

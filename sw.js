const CACHE='centro-ejecutivo-fase4-v1';
const ASSETS=['./','index.html','assets/css/styles.css','assets/js/app.js','data/kpi-data.json','assets/img/centro-ejecutivo-logo.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));

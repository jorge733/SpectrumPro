// Service worker de SpectrumPro.
// - Páginas: primero red (siempre la versión nueva); sin conexión, la última copia guardada.
// - Archivos propios (css, js, imágenes): también primero red; sin conexión, la copia guardada.
//   (Antes se servía la copia guardada y, tras publicar, se mezclaba HTML nuevo con JS viejo.)
// - Supabase y CDNs: pasan directo, nunca se guardan (son datos privados o con su propia caché).
const VERSION = 'spectrumpro-v15';
const BASE = ['./', './index.html', './styles.css', './config.js', './js/datos.js', './js/app.js', './js/posts.js', './manifest.webmanifest', './assets/logo.svg', './assets/icono-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(r => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); } return r; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(g => g || caches.match('./index.html')))
    );
    return;
  }
  // Archivos propios: también primero red, para que HTML, JS y CSS sean siempre de la misma versión.
  // Sin conexión se usa la copia guardada.
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(r => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); } return r; })
      .catch(() => caches.match(req))
  );
});

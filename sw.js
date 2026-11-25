// La plataforma se mudó a /plataforma/ (con su propio service worker).
// Este archivo reemplaza al antiguo service worker de la raíz: en los navegadores
// que ya lo tenían instalado borra sus copias guardadas y se da de baja, para que
// el sitio público de la raíz siempre se cargue desde la red.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k.startsWith('spectrumpro-v')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const ventanas = await self.clients.matchAll({ type: 'window' });
    ventanas.forEach(v => v.navigate(v.url));
  })());
});

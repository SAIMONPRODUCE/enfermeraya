// v2: borra el cache v1, que guardaba respuestas privadas de la API (perfiles, servicios, notificaciones).
const CACHE = 'enfermeraya-v2'
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './icon.svg'])))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
})
self.addEventListener('fetch', (e) => {
  // Solo la app (mismo origen). Las respuestas de Supabase llevan datos de la sesion: nunca al cache.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy))
        }
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./'))),
  )
})

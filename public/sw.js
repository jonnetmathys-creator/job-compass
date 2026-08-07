// Service worker JobCompass : coquille hors-ligne minimale.
// Réseau d'abord pour les navigations ; en cas de coupure, on sert /offline.
// Volontairement léger : on ne met pas en cache les assets Next (hashés/streamés)
// pour ne pas interférer avec le rendu ni servir du contenu périmé.
const CACHE = 'jobcompass-v1'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.add(OFFLINE_URL)
    self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  event.respondWith((async () => {
    try {
      return await fetch(req)
    } catch {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(OFFLINE_URL)
      return cached ?? new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  })())
})

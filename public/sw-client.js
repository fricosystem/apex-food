/* APEX FOOD — Service Worker da tela do cliente (mesa/QR Code)
 * Estratégias:
 *  - Navegação: network-first com fallback ao cache (abre mesmo offline)
 *  - Estáticos (_next/static, /icons, logo): cache-first
 *  - APIs GET (cardápio/comanda): network-first com fallback ao cache (menu offline)
 * Instalado apenas quando o cliente abre a tela da mesa; desregistrado ao sair.
 */
const CACHE = 'apex-client-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // Navegação: rede primeiro, cache como fallback offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    )
    return
  }

  // Estáticos imutáveis: cache-first
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/sounds/') ||
    url.pathname === '/apex-logo.png'
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          })
      )
    )
    return
  }

  // APIs GET: network-first com fallback ao cache (cardápio/comanda offline)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req))
    )
  }
})

/* Notificações (barra de notificações do sistema — desktop/tablet/PWA).
 * Ao clicar no aviso: foca a janela aberta (ou abre o app) e repassa o tipo
 * de ação para a página rotear até a tela certa. */
self.addEventListener('notificationclick', (event) => {
  const kind = event.notification?.data?.kind ?? null
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          client.postMessage({ type: 'apex-notification-click', kind })
          return
        }
      }
      await self.clients.openWindow('/')
    })()
  )
})

/* Push (reservado para notificações em segundo plano com servidor próprio).
 * Payload JSON esperado: { title, body, kind } */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  if (!data.title) return
  event.waitUntil(
    self.registration.showNotification(String(data.title), {
      body: data.body,
      tag: data.tag ?? 'apex-push',
      renotify: true,
      silent: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { kind: data.kind ?? null },
    })
  )
})

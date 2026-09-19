/* APEX FOOD — Service Worker do app principal (login/dashboard/gestão)
 * Mesma estratégia do sw-client.js (tela do cliente), com cache próprio:
 *  - Navegação: network-first com fallback ao cache (abre mesmo offline)
 *  - Estáticos (_next/static, /icons, logo): cache-first
 *  - APIs GET: network-first, sem fallback ao cache (dados operacionais em
 *    tempo real — nunca mostrar dado desatualizado do caixa/cozinha/comandas)
 * Registrado assim que o app carrega (fora do modo cliente), para permitir
 * a instalação como PWA em qualquer dispositivo.
 */
const CACHE = 'apex-app-v1'

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

  // Nunca cacheia respostas de API: dados operacionais precisam vir sempre da rede
  if (url.pathname.startsWith('/api/')) return

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
  }
})

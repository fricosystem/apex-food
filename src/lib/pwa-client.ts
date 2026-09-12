/**
 * PWA da tela do cliente (mesa/QR Code) — ativado APENAS no modo cliente.
 *
 * Ao montar a ClientView:
 *  - aponta <link rel="manifest"> para o manifest gerado por mesa
 *    (start_url = /#m/{token} → ícone instalado abre a comanda da mesa)
 *  - injeta metas de instalação (theme-color escuro, iOS apple-* e apple-touch-icon)
 *  - registra o service worker /sw-client.js (cardápio offline)
 *
 * Ao sair do modo cliente tudo é restaurado/removido, mantendo o PWA
 * restrito à experiência do cliente na mesa.
 */

const MARKER = 'data-apex-client-pwa'

type Removable = () => void

function setMeta(
  selector: string,
  create: () => HTMLMetaElement | HTMLLinkElement,
  apply: (el: HTMLMetaElement | HTMLLinkElement) => void
): Removable {
  let el = document.querySelector<HTMLMetaElement | HTMLLinkElement>(selector)
  const prev = el?.getAttribute('href') ?? el?.getAttribute('content') ?? null
  const owned = !el
  if (!el) {
    el = create()
    el.setAttribute(MARKER, '1')
    document.head.appendChild(el)
  }
  apply(el)
  return () => {
    if (owned) el?.remove()
    else if (prev !== null) {
      if (el?.hasAttribute('href')) el.setAttribute('href', prev)
      else el?.setAttribute('content', prev)
    }
  }
}

export function setupClientPwa(token: string): () => void {
  if (typeof window === 'undefined') return () => {}

  const cleanups: Removable[] = []
  const disposed = { value: false }

  // 1) Manifest por mesa
  const manifestUrl = `/api/client-manifest?token=${encodeURIComponent(token)}`
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  const prevHref = link?.getAttribute('href') ?? null
  const ownedLink = !link
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    link.setAttribute(MARKER, '1')
    document.head.appendChild(link)
  }
  link.href = manifestUrl
  cleanups.push(() => {
    if (ownedLink) link?.remove()
    else if (prevHref !== null) link?.setAttribute('href', prevHref)
  })

  // 2) Theme-color escuro (tela do cliente é sempre dark)
  cleanups.push(
    setMeta('meta[name="theme-color"]', () => {
      const m = document.createElement('meta')
      m.name = 'theme-color'
      return m
    }, (el) => el.setAttribute('content', '#0A0A0C'))
  )

  // 3) Metas iOS (Add to Home Screen)
  const apple: Array<[string, string, string]> = [
    ['apple-mobile-web-app-capable', 'content', 'yes'],
    ['apple-mobile-web-app-status-bar-style', 'content', 'black-translucent'],
    ['apple-mobile-web-app-title', 'content', 'APEX FOOD'],
  ]
  for (const [name, , value] of apple) {
    const sel = `meta[name="${name}"]`
    cleanups.push(
      setMeta(sel, () => {
        const m = document.createElement('meta')
        m.name = name
        return m
      }, (el) => el.setAttribute('content', value))
    )
  }

  // 4) Ícone iOS
  const iconSel = 'link[rel="apple-touch-icon"]'
  let icon = document.querySelector<HTMLLinkElement>(iconSel)
  const prevIcon = icon?.getAttribute('href') ?? null
  const ownedIcon = !icon
  if (!icon) {
    icon = document.createElement('link')
    icon.rel = 'apple-touch-icon'
    icon.setAttribute(MARKER, '1')
    document.head.appendChild(icon)
  }
  icon.href = '/icons/apple-touch-icon.png'
  cleanups.push(() => {
    if (ownedIcon) icon?.remove()
    else if (prevIcon !== null) icon?.setAttribute('href', prevIcon)
  })

  // 5) Service worker (apenas client mode)
  const swRegister = navigator.serviceWorker
    ?.register('/sw-client.js', { scope: '/' })
    .catch(() => null)
  cleanups.push(() => {
    void swRegister?.then((reg) => reg?.unregister()).catch(() => null)
  })

  return () => {
    if (disposed.value) return
    disposed.value = true
    for (const fn of cleanups) {
      try {
        fn()
      } catch {
        /* noop */
      }
    }
  }
}

/** true quando a página já roda como app instalado (standalone) */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

import type { MetadataRoute } from 'next'

/**
 * Web App Manifest do app principal (staff) — instalável em qualquer
 * dispositivo (desktop, tablet, celular). O manifest da tela do cliente
 * (mesa/QR Code) é outro, gerado por mesa em /api/client-manifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'APEX FOOD — Gestão de Restaurante',
    short_name: 'APEX FOOD',
    description:
      'Plataforma de gestão e operação para restaurantes: comandas em tempo real, cozinha, caixa e métricas.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0E0E10',
    theme_color: '#0E0E10',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

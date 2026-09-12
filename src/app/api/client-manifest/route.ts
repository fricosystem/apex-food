import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Manifest do PWA da tela do cliente — gerado por mesa.
 * O start_url leva direto para a comanda da mesa (/#m/{qrToken}),
 * então o ícone instalado no celular abre o cardápio da própria mesa.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') ?? ''

  let name = 'APEX FOOD'
  let startUrl = '/'

  if (/^[A-Za-z0-9]{4,64}$/.test(token)) {
    try {
      const table = await db.restaurantTable.findUnique({
        where: { qrToken: token },
        select: { number: true },
      })
      if (table) {
        name = `APEX FOOD — Mesa ${String(table.number).padStart(2, '0')}`
        startUrl = `/#m/${token}`
      }
    } catch {
      // banco indisponível → manifest genérico
    }
  }

  const manifest = {
    id: startUrl,
    name,
    short_name: 'APEX FOOD',
    description:
      'Cardápio digital APEX FOOD: peça pelo celular, personalize seu pedido e acompanhe cada prato em tempo real, do preparo à entrega.',
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0A0A0C',
    theme_color: '#0E0E10',
    lang: 'pt-BR',
    dir: 'ltr',
    categories: ['food', 'restaurant'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { qrLookupCol, tablesCol, categoriesCol, productsCol, establishmentsCol } from '@/lib/fs'

type Ctx = { params: Promise<{ token: string }> }

/**
 * Cardápio público da tela do cliente (QR Code da mesa — sem login).
 * Valida o token da mesa e retorna apenas categorias/produtos ativos com campos públicos.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const lookupSnap = await qrLookupCol().doc(token).get()
  if (!lookupSnap.exists) return NextResponse.json({ error: 'Mesa não encontrada. Chame um funcionário.' }, { status: 404 })
  const { establishmentId: estId, tableId } = lookupSnap.data() as { establishmentId: string; tableId: string }

  const [tableSnap, estSnap] = await Promise.all([tablesCol(estId).doc(tableId).get(), establishmentsCol().doc(estId).get()])
  const table = tableSnap.data() as { active: boolean } | undefined
  if (!tableSnap.exists) return NextResponse.json({ error: 'Mesa não encontrada. Chame um funcionário.' }, { status: 404 })
  if (!table?.active) return NextResponse.json({ error: 'Mesa desativada. Chame um funcionário.' }, { status: 403 })
  const est = estSnap.data() as { active: boolean; name: string; logo: string; type: string } | undefined
  if (est && !est.active) return NextResponse.json({ error: 'Estabelecimento indisponível no momento.' }, { status: 403 })

  const [catsSnap, prodsSnap] = await Promise.all([
    categoriesCol(estId).where('active', '==', true).orderBy('sortOrder', 'asc').get(),
    productsCol(estId).where('active', '==', true).orderBy('createdAt', 'asc').get(),
  ])
  const cats = catsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as { id: string; name: string; sector: string; icon: string; sortOrder: number })
  const products = prodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as { id: string; categoryId: string; active: boolean } & Record<string, unknown>)

  const categories = cats.map((c) => ({
    id: c.id, name: c.name, sector: c.sector, icon: c.icon, sortOrder: c.sortOrder,
    products: products
      .filter((p) => p.categoryId === c.id)
      .map((p) => ({
        id: p.id, name: p.name, description: p.description, emoji: p.emoji, image: p.image,
        price: p.price, prepTime: p.prepTime, categoryId: p.categoryId,
        category: { id: c.id, name: c.name, sector: c.sector, icon: c.icon },
      })),
  }))

  return NextResponse.json({ categories, establishment: est ? { name: est.name, logo: est.logo, type: est.type } : null })
}

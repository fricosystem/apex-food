import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ token: string }> }

/**
 * Cardápio público da tela do cliente (QR Code da mesa — sem login).
 * Valida o token da mesa e retorna apenas categorias/produtos ativos com campos públicos.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const table = await db.restaurantTable.findUnique({
    where: { qrToken: token },
    select: { id: true, active: true, establishmentId: true, establishment: { select: { active: true, name: true, logo: true, type: true } } },
  })
  if (!table) return NextResponse.json({ error: 'Mesa não encontrada. Chame um funcionário.' }, { status: 404 })
  if (!table.active) return NextResponse.json({ error: 'Mesa desativada. Chame um funcionário.' }, { status: 403 })
  if (table.establishment && !table.establishment.active) {
    return NextResponse.json({ error: 'Estabelecimento indisponível no momento.' }, { status: 403 })
  }

  const categories = await db.category.findMany({
    where: { active: true, ...(table.establishmentId ? { establishmentId: table.establishmentId } : {}) },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true, name: true, sector: true, icon: true, sortOrder: true,
      products: {
        where: { active: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, name: true, description: true, emoji: true, image: true,
          price: true, prepTime: true, categoryId: true,
          category: { select: { id: true, name: true, sector: true, icon: true } },
        },
      },
    },
  })

  return NextResponse.json({ categories, establishment: table.establishment ? { name: table.establishment.name, logo: table.establishment.logo, type: table.establishment.type } : null })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

export async function GET(req: NextRequest) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const includeInactive = new URL(req.url).searchParams.get('all') === '1'
  const categories = await db.category.findMany({
    where: { establishmentId: auth.establishmentId, ...(includeInactive ? {} : { active: true }) },
    orderBy: { sortOrder: 'asc' },
    include: {
      products: {
        where: includeInactive ? {} : { active: true },
        orderBy: { createdAt: 'asc' },
        include: { category: true },
      },
    },
  })
  return NextResponse.json({ categories })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const body = await readJson<{ name?: string; sector?: string; icon?: string; sortOrder?: number }>(req)
  const name = body?.name?.trim()
  if (!name) return bad('Informe o nome da categoria')
  try {
    const cat = await db.category.create({
      data: {
        name,
        sector: body?.sector || 'KITCHEN',
        icon: body?.icon || '🍽️',
        sortOrder: body?.sortOrder ?? 99,
        establishmentId: auth.establishmentId,
      },
    })
    broadcast('dados:alterados', { type: 'category' })
    return NextResponse.json({ category: cat })
  } catch {
    return bad('Já existe uma categoria com esse nome', 409)
  }
}

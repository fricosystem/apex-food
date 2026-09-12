import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth
  const includeInactive = new URL(req.url).searchParams.get('all') === '1'
  const products = await db.product.findMany({
    where: includeInactive ? {} : { active: true },
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ products })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const body = await readJson<{
    name?: string; description?: string; price?: number; prepTime?: number
    emoji?: string; image?: string; categoryId?: string
  }>(req)
  const name = body?.name?.trim()
  if (!name) return bad('Informe o nome do produto')
  if (!body?.categoryId) return bad('Selecione a categoria')
  if (!body?.price || body.price <= 0) return bad('Informe um preço válido')
  const product = await db.product.create({
    data: {
      name,
      description: body?.description?.trim() ?? '',
      price: body.price,
      prepTime: Math.max(1, Math.round(body?.prepTime ?? 15)),
      emoji: body?.emoji || '🍽️',
      image: body?.image?.trim() || null,
      categoryId: body.categoryId,
    },
    include: { category: true },
  })
  broadcast('dados:alterados', { type: 'product' })
  return NextResponse.json({ product })
}

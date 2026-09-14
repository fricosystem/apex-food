import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

export async function GET(req: NextRequest) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const params = new URL(req.url).searchParams
  const includeInactive = params.get('all') === '1'
  const kind = params.get('kind')
  const products = await db.product.findMany({
    where: {
      establishmentId: auth.establishmentId,
      ...(includeInactive ? {} : { active: true }),
      ...(kind === 'PRODUCT' || kind === 'MEAL' ? { kind } : {}),
    },
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ products })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const body = await readJson<{
    name?: string; description?: string; price?: number; prepTime?: number
    emoji?: string; image?: string; categoryId?: string; kind?: string
  }>(req)
  const name = body?.name?.trim()
  if (!name) return bad('Informe o nome do produto')
  if (!body?.categoryId) return bad('Selecione a categoria')
  if (!body?.price || body.price <= 0) return bad('Informe um preço válido')
  // A categoria precisa pertencer ao próprio estabelecimento
  const category = await db.category.findFirst({
    where: { id: body.categoryId, establishmentId: auth.establishmentId },
  })
  if (!category) return bad('Categoria inválida', 404)
  const product = await db.product.create({
    data: {
      name,
      description: body?.description?.trim() ?? '',
      price: body.price,
      prepTime: Math.max(1, Math.round(body?.prepTime ?? 15)),
      emoji: body?.emoji || '🍽️',
      image: body?.image?.trim() || null,
      categoryId: body.categoryId,
      kind: body?.kind === 'MEAL' ? 'MEAL' : 'PRODUCT',
      establishmentId: auth.establishmentId,
    },
    include: { category: true },
  })
  broadcast('dados:alterados', { type: 'product' })
  return NextResponse.json({ product })
}

import { NextRequest, NextResponse } from 'next/server'
import { productsCol, categoriesCol, tsToIso } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

export async function GET(req: NextRequest) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const params = new URL(req.url).searchParams
  const includeInactive = params.get('all') === '1'
  const kind = params.get('kind')

  const [prodsSnap, catsSnap] = await Promise.all([
    productsCol(auth.establishmentId).orderBy('createdAt', 'asc').get(),
    categoriesCol(auth.establishmentId).get(),
  ])
  const cats = new Map(
    catsSnap.docs.map((d) => {
      const c = d.data() as { createdAt: unknown } & Record<string, unknown>
      return [d.id, { id: d.id, ...c, createdAt: tsToIso(c.createdAt) }]
    }),
  )

  const products = prodsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as { active: boolean; kind: string; categoryId: string; createdAt: unknown; updatedAt: unknown } & Record<string, unknown>)
    .filter((p) => (includeInactive || p.active) && (kind === 'PRODUCT' || kind === 'MEAL' ? p.kind === kind : true))
    .map((p) => ({ ...p, createdAt: tsToIso(p.createdAt), updatedAt: tsToIso(p.updatedAt), category: cats.get(p.categoryId) ?? null }))

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

  const catSnap = await categoriesCol(auth.establishmentId).doc(body.categoryId).get()
  if (!catSnap.exists) return bad('Categoria inválida', 404)

  const now = new Date()
  const data = {
    name,
    description: body?.description?.trim() ?? '',
    price: body.price,
    prepTime: Math.max(1, Math.round(body?.prepTime ?? 15)),
    emoji: body?.emoji || '🍽️',
    image: body?.image?.trim() || null,
    categoryId: body.categoryId,
    kind: body?.kind === 'MEAL' ? 'MEAL' : 'PRODUCT',
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const ref = await productsCol(auth.establishmentId).add(data)
  const catData = catSnap.data() as { createdAt: unknown } & Record<string, unknown>
  broadcast('dados:alterados', { type: 'product' })
  return NextResponse.json({
    product: {
      id: ref.id, ...data, createdAt: now.toISOString(), updatedAt: now.toISOString(),
      category: { id: catSnap.id, ...catData, createdAt: tsToIso(catData.createdAt) },
    },
  })
}

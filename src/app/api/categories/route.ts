import { NextRequest, NextResponse } from 'next/server'
import { categoriesCol, productsCol, tsToIso } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

export async function GET(req: NextRequest) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const includeInactive = new URL(req.url).searchParams.get('all') === '1'

  const [catsSnap, prodsSnap] = await Promise.all([
    categoriesCol(auth.establishmentId).orderBy('sortOrder', 'asc').get(),
    productsCol(auth.establishmentId).orderBy('createdAt', 'asc').get(),
  ])

  const categories = catsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as { id: string; active: boolean; createdAt: unknown } & Record<string, unknown>)
    .filter((c) => includeInactive || c.active)
    .map((c) => ({ ...c, createdAt: tsToIso(c.createdAt) }))

  const productsByCategory = new Map<string, Array<Record<string, unknown>>>()
  for (const d of prodsSnap.docs) {
    const p = { id: d.id, ...d.data() } as { categoryId: string; active: boolean; createdAt: unknown; updatedAt: unknown } & Record<string, unknown>
    if (!includeInactive && !p.active) continue
    const cat = categories.find((c) => c.id === p.categoryId)
    const list = productsByCategory.get(p.categoryId) ?? []
    list.push({ ...p, createdAt: tsToIso(p.createdAt), updatedAt: tsToIso(p.updatedAt), category: cat ?? null })
    productsByCategory.set(p.categoryId, list)
  }

  const rows = categories.map((c) => ({ ...c, products: productsByCategory.get(c.id) ?? [] }))
  return NextResponse.json({ categories: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const body = await readJson<{ name?: string; sector?: string; icon?: string; sortOrder?: number }>(req)
  const name = body?.name?.trim()
  if (!name) return bad('Informe o nome da categoria')

  const dup = await categoriesCol(auth.establishmentId).where('name', '==', name).limit(1).get()
  if (!dup.empty) return bad('Já existe uma categoria com esse nome', 409)

  const data = {
    name,
    sector: body?.sector || 'KITCHEN',
    icon: body?.icon || '🍽️',
    sortOrder: body?.sortOrder ?? 99,
    active: true,
    createdAt: new Date(),
  }
  const ref = await categoriesCol(auth.establishmentId).add(data)
  broadcast('dados:alterados', { type: 'category' })
  return NextResponse.json({ category: { id: ref.id, ...data } })
}

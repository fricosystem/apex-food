import { NextRequest, NextResponse } from 'next/server'
import { productsCol, categoriesCol, tsToIso } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{
    name?: string; description?: string; price?: number; prepTime?: number
    emoji?: string; image?: string | null; categoryId?: string; active?: boolean; kind?: string
  }>(req)
  const ref = productsCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Produto não encontrado', 404)
  const existing = snap.data() as {
    name: string; description: string; price: number; prepTime: number
    emoji: string; image: string | null; categoryId: string; active: boolean; kind: string
  }

  const now = new Date()
  const data = {
    name: body?.name?.trim() || existing.name,
    description: body?.description?.trim() ?? existing.description,
    price: body?.price && body.price > 0 ? body.price : existing.price,
    prepTime: body?.prepTime ? Math.max(1, Math.round(body.prepTime)) : existing.prepTime,
    emoji: body?.emoji || existing.emoji,
    image: body?.image === undefined ? existing.image : body.image || null,
    categoryId: body?.categoryId ?? existing.categoryId,
    kind: body?.kind === 'MEAL' || body?.kind === 'PRODUCT' ? body.kind : existing.kind,
    active: body?.active ?? existing.active,
    updatedAt: now,
  }
  await ref.update(data)
  const catSnap = await categoriesCol(auth.establishmentId).doc(data.categoryId).get()
  const catData = catSnap.data() as ({ createdAt: unknown } & Record<string, unknown>) | undefined
  broadcast('dados:alterados', { type: 'product' })
  return NextResponse.json({
    product: {
      id, ...existing, ...data,
      createdAt: tsToIso((existing as { createdAt?: unknown }).createdAt),
      updatedAt: now.toISOString(),
      category: catSnap.exists ? { id: catSnap.id, ...catData, createdAt: tsToIso(catData?.createdAt) } : null,
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const ref = productsCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Produto não encontrado', 404)
  // `everUsed` é marcado quando o produto entra em algum item de comanda (ver orders/route.ts) —
  // como o histórico de comandas guarda nome/preço/emoji do produto no próprio item (denormalizado),
  // apagar o produto não quebra comandas antigas; ainda assim preferimos só desativar, para manter
  // o produto visível no histórico de gestão.
  if (snap.data()?.everUsed) {
    await ref.update({ active: false, updatedAt: new Date() })
    broadcast('dados:alterados', { type: 'product' })
    return NextResponse.json({ ok: true, deactivated: true })
  }
  await ref.delete()
  broadcast('dados:alterados', { type: 'product' })
  return NextResponse.json({ ok: true })
}

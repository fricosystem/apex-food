import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{
    name?: string; description?: string; price?: number; prepTime?: number
    emoji?: string; image?: string | null; categoryId?: string; active?: boolean
  }>(req)
  const existing = await db.product.findUnique({ where: { id } })
  if (!existing) return bad('Produto não encontrado', 404)

  const product = await db.product.update({
    where: { id },
    data: {
      name: body?.name?.trim() || existing.name,
      description: body?.description?.trim() ?? existing.description,
      price: body?.price && body.price > 0 ? body.price : existing.price,
      prepTime: body?.prepTime ? Math.max(1, Math.round(body.prepTime)) : existing.prepTime,
      emoji: body?.emoji || existing.emoji,
      image: body?.image === undefined ? existing.image : body.image || null,
      categoryId: body?.categoryId ?? existing.categoryId,
      active: body?.active ?? existing.active,
    },
    include: { category: true },
  })
  broadcast('dados:alterados', { type: 'product' })
  return NextResponse.json({ product })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const used = await db.orderItem.count({ where: { productId: id } })
  if (used > 0) {
    await db.product.update({ where: { id }, data: { active: false } })
    broadcast('dados:alterados', { type: 'product' })
    return NextResponse.json({ ok: true, deactivated: true })
  }
  await db.product.delete({ where: { id } })
  broadcast('dados:alterados', { type: 'product' })
  return NextResponse.json({ ok: true })
}

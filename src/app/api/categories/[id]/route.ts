import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{ name?: string; sector?: string; icon?: string; active?: boolean; sortOrder?: number }>(req)
  const existing = await db.category.findUnique({ where: { id } })
  if (!existing || existing.establishmentId !== auth.establishmentId) return bad('Categoria não encontrada', 404)
  const cat = await db.category.update({
    where: { id },
    data: {
      name: body?.name?.trim() || existing.name,
      sector: body?.sector ?? existing.sector,
      icon: body?.icon ?? existing.icon,
      active: body?.active ?? existing.active,
      sortOrder: body?.sortOrder ?? existing.sortOrder,
    },
  })
  broadcast('dados:alterados', { type: 'category' })
  return NextResponse.json({ category: cat })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const existingCat = await db.category.findUnique({ where: { id } })
  if (!existingCat || existingCat.establishmentId !== auth.establishmentId) return bad('Categoria não encontrada', 404)
  const products = await db.product.count({ where: { categoryId: id } })
  if (products > 0) return bad('Não é possível excluir: existem produtos vinculados. Desative a categoria.')
  await db.category.delete({ where: { id } })
  broadcast('dados:alterados', { type: 'category' })
  return NextResponse.json({ ok: true })
}

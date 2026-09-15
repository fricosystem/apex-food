import { NextRequest, NextResponse } from 'next/server'
import { categoriesCol, productsCol, countDocs, tsToIso } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{ name?: string; sector?: string; icon?: string; active?: boolean; sortOrder?: number }>(req)
  const ref = categoriesCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Categoria não encontrada', 404)
  const existing = snap.data() as { name: string; sector: string; icon: string; active: boolean; sortOrder: number }

  const data = {
    name: body?.name?.trim() || existing.name,
    sector: body?.sector ?? existing.sector,
    icon: body?.icon ?? existing.icon,
    active: body?.active ?? existing.active,
    sortOrder: body?.sortOrder ?? existing.sortOrder,
  }
  await ref.update(data)
  broadcast('dados:alterados', { type: 'category' })
  return NextResponse.json({ category: { id, ...existing, ...data, createdAt: tsToIso((existing as { createdAt?: unknown }).createdAt) } })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const ref = categoriesCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Categoria não encontrada', 404)
  const products = await countDocs(productsCol(auth.establishmentId).where('categoryId', '==', id))
  if (products > 0) return bad('Não é possível excluir: existem produtos vinculados. Desative a categoria.')
  await ref.delete()
  broadcast('dados:alterados', { type: 'category' })
  return NextResponse.json({ ok: true })
}

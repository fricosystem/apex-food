import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

/** PATCH /api/platform/plans/[id] — atualiza plano (SUPER_ADMIN) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(['SUPER_ADMIN'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const plan = await db.plan.findUnique({ where: { id } })
  if (!plan) return bad('Plano não encontrado', 404)

  const body = await readJson<{ name?: string; price?: number; duration?: number; features?: string; sortOrder?: number }>(req)
  if (!body) return bad('Payload inválido')

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
  if (typeof body.price === 'number' && body.price >= 0) data.price = Math.round(body.price * 100) / 100
  if (typeof body.duration === 'number' && body.duration > 0) data.duration = Math.round(body.duration)
  if (typeof body.features === 'string') data.features = body.features.slice(0, 1000)
  if (typeof body.sortOrder === 'number') data.sortOrder = Math.round(body.sortOrder)

  const updated = await db.plan.update({ where: { id }, data })
  return NextResponse.json({ plan: updated })
}

/** DELETE /api/platform/plans/[id] — remove plano sem assinantes (SUPER_ADMIN) */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(['SUPER_ADMIN'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const plan = await db.plan.findUnique({ where: { id } })
  if (!plan) return bad('Plano não encontrado', 404)
  const inUse = await db.establishment.count({ where: { plan: plan.key } })
  if (inUse > 0) return bad(`Este plano está em uso por ${inUse} estabelecimento(s)`, 409)
  await db.plan.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

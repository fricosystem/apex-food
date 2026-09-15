import { NextRequest, NextResponse } from 'next/server'
import { plansCol, establishmentsCol, countDocs } from '@/lib/fs'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { PLATFORM_ROLES } from '@/lib/permissions'

type Ctx = { params: Promise<{ id: string }> }

/** PATCH /api/platform/plans/[id] — atualiza plano (cargos de gestão da plataforma) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const { id } = await params
  const ref = plansCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Plano não encontrado', 404)
  const existing = snap.data()!

  const body = await readJson<{ name?: string; price?: number; duration?: number; features?: string; sortOrder?: number }>(req)
  if (!body) return bad('Payload inválido')

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
  if (typeof body.price === 'number' && body.price >= 0) data.price = Math.round(body.price * 100) / 100
  if (typeof body.duration === 'number' && body.duration > 0) data.duration = Math.round(body.duration)
  if (typeof body.features === 'string') data.features = body.features.slice(0, 1000)
  if (typeof body.sortOrder === 'number') data.sortOrder = Math.round(body.sortOrder)

  await ref.update(data)
  return NextResponse.json({ plan: { id, ...existing, ...data } })
}

/** DELETE /api/platform/plans/[id] — remove plano sem assinantes (cargos de gestão da plataforma) */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const { id } = await params
  const ref = plansCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Plano não encontrado', 404)
  const inUse = await countDocs(establishmentsCol().where('plan', '==', id))
  if (inUse > 0) return bad(`Este plano está em uso por ${inUse} estabelecimento(s)`, 409)
  await ref.delete()
  return NextResponse.json({ ok: true })
}

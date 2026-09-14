import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{ title?: string; target?: number; active?: boolean }>(req)
  const existing = await db.goal.findUnique({ where: { id } })
  if (!existing || existing.establishmentId !== auth.establishmentId) return bad('Meta não encontrada', 404)
  const goal = await db.goal.update({
    where: { id },
    data: {
      title: body?.title?.trim() || existing.title,
      target: body?.target ? Math.max(1, Math.round(body.target)) : existing.target,
      active: body?.active ?? existing.active,
    },
  })
  broadcast('dados:alterados', { type: 'goal' })
  return NextResponse.json({ goal })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const existingGoal = await db.goal.findUnique({ where: { id } })
  if (!existingGoal || existingGoal.establishmentId !== auth.establishmentId) return bad('Meta não encontrada', 404)
  await db.goal.delete({ where: { id } })
  broadcast('dados:alterados', { type: 'goal' })
  return NextResponse.json({ ok: true })
}

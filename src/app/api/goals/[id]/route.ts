import { NextRequest, NextResponse } from 'next/server'
import { goalsCol, tsToIso } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{ title?: string; target?: number; active?: boolean }>(req)
  const ref = goalsCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Meta não encontrada', 404)
  const existing = snap.data() as { title: string; target: number; active: boolean }
  const data = {
    title: body?.title?.trim() || existing.title,
    target: body?.target ? Math.max(1, Math.round(body.target)) : existing.target,
    active: body?.active ?? existing.active,
  }
  await ref.update(data)
  broadcast('dados:alterados', { type: 'goal' })
  return NextResponse.json({ goal: { id, ...existing, ...data, createdAt: tsToIso((existing as { createdAt?: unknown }).createdAt) } })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const ref = goalsCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Meta não encontrada', 404)
  await ref.delete()
  broadcast('dados:alterados', { type: 'goal' })
  return NextResponse.json({ ok: true })
}

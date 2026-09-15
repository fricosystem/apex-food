import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { usersCol, ordersCol, goalsCol, countDocs } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'
import { TENANT_ROLES } from '@/lib/permissions'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{ name?: string; role?: string; active?: boolean; password?: string; status?: string }>(req)
  const ref = usersCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Usuário não encontrado', 404)
  const existing = snap.data() as { name: string; email: string; role: string; status: string; active: boolean; establishmentId?: string }
  // Isolamento: só edita usuários do próprio estabelecimento; nunca DESENVOLVEDOR
  if (existing.establishmentId !== auth.establishmentId || existing.role === 'DESENVOLVEDOR') {
    return bad('Usuário não encontrado', 404)
  }
  if (id === auth.id && body?.active === false) return bad('Você não pode desativar o próprio usuário')

  const data: Record<string, unknown> = {
    name: body?.name?.trim() || existing.name,
    active: body?.active ?? existing.active,
  }
  if (body?.role && (TENANT_ROLES as readonly string[]).includes(body.role)) data.role = body.role
  if (body?.status && ['ONLINE', 'BUSY', 'OFFLINE'].includes(body.status)) data.status = body.status
  if (body?.password && body.password.length >= 4) {
    await adminAuth.updateUser(id, { password: body.password }).catch(() => {})
  }

  await ref.update(data)
  broadcast('dados:alterados', { type: 'user' })
  return NextResponse.json({ user: { id, ...existing, ...data } })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN'])
  if (isResponse(auth)) return auth
  const { id } = await params
  if (id === auth.id) return bad('Você não pode excluir o próprio usuário')
  const ref = usersCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Usuário não encontrado', 404)
  const existing = snap.data() as { establishmentId?: string; role?: string }
  if (existing.establishmentId !== auth.establishmentId || existing.role === 'DESENVOLVEDOR') {
    return bad('Usuário não encontrado', 404)
  }
  const orders = await countDocs(ordersCol(auth.establishmentId).where('waiterId', '==', id))
  if (orders > 0) {
    await ref.update({ active: false })
    broadcast('dados:alterados', { type: 'user' })
    return NextResponse.json({ ok: true, deactivated: true })
  }
  const goalsSnap = await goalsCol(auth.establishmentId).where('userId', '==', id).get()
  const batch = ref.firestore.batch()
  for (const d of goalsSnap.docs) batch.delete(d.ref)
  batch.delete(ref)
  await batch.commit()
  await adminAuth.deleteUser(id).catch(() => {})
  broadcast('dados:alterados', { type: 'user' })
  return NextResponse.json({ ok: true })
}

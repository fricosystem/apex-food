import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { hashPassword } from '@/lib/auth'
import { broadcast } from '@/lib/realtime'
import { TENANT_ROLES } from '@/lib/permissions'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{ name?: string; role?: string; active?: boolean; password?: string; status?: string }>(req)
  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return bad('Usuário não encontrado', 404)
  // Isolamento: só edita usuários do próprio estabelecimento; nunca SUPER_ADMIN
  if (existing.establishmentId !== auth.establishmentId || existing.role === 'SUPER_ADMIN') {
    return bad('Usuário não encontrado', 404)
  }
  if (existing.id === auth.id && body?.active === false) return bad('Você não pode desativar o próprio usuário')

  const data: Record<string, unknown> = {
    name: body?.name?.trim() || existing.name,
    active: body?.active ?? existing.active,
  }
  if (body?.role && (TENANT_ROLES as readonly string[]).includes(body.role)) data.role = body.role
  if (body?.password && body.password.length >= 4) data.password = hashPassword(body.password)
  if (body?.status && ['ONLINE', 'BUSY', 'OFFLINE'].includes(body.status)) data.status = body.status

  const user = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, status: true, active: true, createdAt: true },
  })
  broadcast('dados:alterados', { type: 'user' })
  return NextResponse.json({ user })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN'])
  if (isResponse(auth)) return auth
  const { id } = await params
  if (id === auth.id) return bad('Você não pode excluir o próprio usuário')
  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return bad('Usuário não encontrado', 404)
  if (existing.establishmentId !== auth.establishmentId || existing.role === 'SUPER_ADMIN') {
    return bad('Usuário não encontrado', 404)
  }
  const orders = await db.order.count({ where: { waiterId: id } })
  if (orders > 0) {
    await db.user.update({ where: { id }, data: { active: false } })
    broadcast('dados:alterados', { type: 'user' })
    return NextResponse.json({ ok: true, deactivated: true })
  }
  await db.goal.deleteMany({ where: { userId: id } })
  await db.user.delete({ where: { id } })
  broadcast('dados:alterados', { type: 'user' })
  return NextResponse.json({ ok: true })
}

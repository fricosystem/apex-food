import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { hashPassword } from '@/lib/auth'
import { broadcast } from '@/lib/realtime'
import { TENANT_ROLES } from '@/lib/permissions'

export async function GET() {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const users = await db.user.findMany({
    where: { establishmentId: auth.establishmentId },
    select: { id: true, name: true, email: true, role: true, status: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  // carga atual de cada garçom
  const activeStatuses = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']
  const waiters = await db.user.findMany({ where: { role: 'WAITER', active: true, establishmentId: auth.establishmentId }, select: { id: true } })
  const loads = await Promise.all(
    waiters.map(async (w) => ({
      id: w.id,
      load: await db.order.count({ where: { waiterId: w.id, status: { in: activeStatuses } } }),
    }))
  )
  return NextResponse.json({ users: users.map((u) => ({ ...u, activeLoad: loads.find((l) => l.id === u.id)?.load ?? null })) })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const body = await readJson<{ name?: string; email?: string; password?: string; role?: string }>(req)
  const name = body?.name?.trim()
  const email = body?.email?.trim().toLowerCase()
  if (!name || !email) return bad('Informe nome e e-mail')
  if (!body?.password || body.password.length < 4) return bad('Senha deve ter pelo menos 4 caracteres')
  const role = body?.role || 'WAITER'
  if (!(TENANT_ROLES as readonly string[]).includes(role)) return bad('Cargo inválido')
  try {
    const user = await db.user.create({
      data: { name, email, password: hashPassword(body.password), role, establishmentId: auth.establishmentId },
      select: { id: true, name: true, email: true, role: true, status: true, active: true, createdAt: true },
    })
    broadcast('dados:alterados', { type: 'user' })
    return NextResponse.json({ user })
  } catch {
    return bad('E-mail já cadastrado', 409)
  }
}

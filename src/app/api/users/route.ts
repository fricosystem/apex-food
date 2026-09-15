import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { usersCol, ordersCol, countDocs } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'
import { TENANT_ROLES } from '@/lib/permissions'

export async function GET() {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const snap = await usersCol().where('establishmentId', '==', auth.establishmentId).get()
  const users = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as { id: string; name: string; email: string; role: string; status: string; active: boolean; createdAt: unknown })
    .sort((a, b) => ((a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0) - ((b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0))

  // carga atual de cada garçom
  const activeStatuses = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']
  const orders = ordersCol(auth.establishmentId)
  const waiters = users.filter((u) => u.role === 'WAITER' && u.active)
  const loads = await Promise.all(
    waiters.map(async (w) => ({ id: w.id, load: await countDocs(orders.where('waiterId', '==', w.id).where('status', 'in', activeStatuses)) })),
  )
  return NextResponse.json({
    users: users.map((u) => {
      const { createdAt, ...rest } = u
      return { ...rest, createdAt: (createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null, activeLoad: loads.find((l) => l.id === u.id)?.load ?? null }
    }),
  })
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

  let uid: string
  try {
    const created = await adminAuth.createUser({ email, password: body.password, displayName: name })
    uid = created.uid
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'auth/email-already-exists') return bad('E-mail já cadastrado', 409)
    if (code === 'auth/invalid-password' || code === 'auth/password-does-not-meet-requirements') {
      return bad('Senha muito simples. Use letras maiúsculas, minúsculas, números e um símbolo.', 400)
    }
    console.error('users createUser failed:', e)
    return bad('Não foi possível criar o usuário', 500)
  }

  const now = new Date()
  const data = { name, email, role, status: 'ONLINE', active: true, establishmentId: auth.establishmentId, createdAt: now }
  await usersCol().doc(uid).set(data)
  broadcast('dados:alterados', { type: 'user' })
  return NextResponse.json({ user: { id: uid, ...data, createdAt: now.toISOString() } })
}

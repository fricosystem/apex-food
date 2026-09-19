import { NextRequest, NextResponse } from 'next/server'
import { goalsCol, usersCol, ordersCol } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

export async function GET(req: NextRequest) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const month = new URL(req.url).searchParams.get('month') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)

  const snap = await goalsCol(auth.establishmentId).where('month', '==', month).where('active', '==', true).get()
  const goals = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as { id: string; userId: string; title: string; target: number; month: string })

  const usersSnap = await Promise.all(goals.map((g) => usersCol().doc(g.userId).get()))

  // Uma única leitura do mês, filtrando só por paidAt (índice automático de campo único).
  // Somar status + waiterId na mesma query exigiria um índice composto (era a causa do
  // FAILED_PRECONDITION); status e waiterId são então filtrados aqui em memória.
  const monthOrdersSnap = await ordersCol(auth.establishmentId).where('paidAt', '>=', start).where('paidAt', '<', end).get()
  const achievedByWaiter = new Map<string, number>()
  for (const doc of monthOrdersSnap.docs) {
    const o = doc.data() as { waiterId?: string; status?: string }
    if (o.status === 'PAID' && o.waiterId) {
      achievedByWaiter.set(o.waiterId, (achievedByWaiter.get(o.waiterId) ?? 0) + 1)
    }
  }

  const result = goals.map((g, i) => {
    const u = usersSnap[i]
    const ud = u.data() as { name: string; role: string } | undefined
    return {
      id: g.id,
      title: g.title,
      target: g.target,
      month: g.month,
      user: ud ? { id: g.userId, name: ud.name, role: ud.role } : null,
      achieved: achievedByWaiter.get(g.userId) ?? 0,
    }
  })
  return NextResponse.json({ goals: result })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const body = await readJson<{ userId?: string; title?: string; target?: number; month?: string }>(req)
  if (!body?.userId) return bad('Selecione o funcionário')
  if (!body?.target || body.target < 1) return bad('Informe a meta (número de comandas)')
  const targetSnap = await usersCol().doc(body.userId).get()
  const targetUser = targetSnap.data() as { name: string; role: string; establishmentId?: string } | undefined
  if (!targetSnap.exists || targetUser?.establishmentId !== auth.establishmentId) return bad('Funcionário inválido', 404)

  const month = body?.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const data = {
    userId: body.userId,
    title: body?.title?.trim() || 'Comandas atendidas no mês',
    target: Math.round(body.target),
    month,
    active: true,
    createdAt: new Date(),
  }
  const ref = await goalsCol(auth.establishmentId).add(data)
  broadcast('dados:alterados', { type: 'goal' })
  return NextResponse.json({ goal: { id: ref.id, ...data, user: { id: body.userId, name: targetUser!.name, role: targetUser!.role }, achieved: 0 } })
}

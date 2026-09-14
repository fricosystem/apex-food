import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

export async function GET(req: NextRequest) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const month = new URL(req.url).searchParams.get('month') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)

  const goals = await db.goal.findMany({
    where: { month, active: true, establishmentId: auth.establishmentId },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const result = await Promise.all(
    goals.map(async (g) => {
      const achieved = await db.order.count({
        where: { waiterId: g.userId, status: 'PAID', paidAt: { gte: start, lt: end } },
      })
      return { id: g.id, title: g.title, target: g.target, month: g.month, user: g.user, achieved }
    })
  )
  return NextResponse.json({ goals: result })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const body = await readJson<{ userId?: string; title?: string; target?: number; month?: string }>(req)
  if (!body?.userId) return bad('Selecione o funcionário')
  if (!body?.target || body.target < 1) return bad('Informe a meta (número de comandas)')
  // O funcionário precisa pertencer ao estabelecimento
  const target = await db.user.findFirst({ where: { id: body.userId, establishmentId: auth.establishmentId } })
  if (!target) return bad('Funcionário inválido', 404)
  const month = body?.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const goal = await db.goal.create({
    data: { userId: body.userId, title: body?.title?.trim() || 'Comandas atendidas no mês', target: Math.round(body.target), month, establishmentId: auth.establishmentId },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  broadcast('dados:alterados', { type: 'goal' })
  return NextResponse.json({ goal: { ...goal, achieved: 0 } })
}

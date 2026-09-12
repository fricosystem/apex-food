import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse } from '@/lib/api'

function inTurn(date: Date, turn: string): boolean {
  const h = date.getHours()
  if (turn === 'morning') return h >= 6 && h < 12
  if (turn === 'afternoon') return h >= 12 && h < 18
  if (turn === 'night') return h >= 18 || h < 6
  return true
}

/** GET /api/metrics?days=7&turn=all — agregações do dashboard */
export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth
  const sp = new URL(req.url).searchParams
  const days = Math.min(90, Math.max(1, Number(sp.get('days') || 7)))
  const turn = sp.get('turn') || 'all'

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))

  const paid = await db.order.findMany({
    where: { status: 'PAID', paidAt: { gte: start } },
    include: {
      waiter: { select: { id: true, name: true } },
      payments: { select: { method: true } },
      items: true,
    },
    orderBy: { paidAt: 'asc' },
  })
  const paidInTurn = paid.filter((o) => o.paidAt && inTurn(o.paidAt, turn))

  // ---- KPIs em tempo real ----
  const [openOrders, tables] = await Promise.all([
    db.order.count({ where: { status: { in: ['PENDING_CONFIRM', 'IN_KITCHEN'] } } }),
    db.restaurantTable.findMany({ where: { active: true }, select: { status: true } }),
  ])
  const occupiedTables = tables.filter((t) => t.status === 'OCCUPIED').length

  const serviceTimes = paidInTurn
    .filter((o) => o.confirmedAt && o.paidAt)
    .map((o) => (o.paidAt!.getTime() - o.confirmedAt!.getTime()) / 60000)
  const avgService = serviceTimes.length ? serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length : 0
  const avgTicket = paidInTurn.length ? paidInTurn.reduce((a, o) => a + o.total, 0) / paidInTurn.length : 0

  // ---- Faturamento por dia ----
  const byDay: Array<{ date: string; label: string; revenue: number; orders: number }> = []
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - d)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const rows = paidInTurn.filter((o) => o.paidAt && o.paidAt >= day && o.paidAt < next)
    byDay.push({
      date: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      revenue: Math.round(rows.reduce((a, o) => a + o.total, 0) * 100) / 100,
      orders: rows.length,
    })
  }

  // ---- Produtos mais vendidos ----
  const productAgg = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const o of paidInTurn) {
    for (const it of o.items) {
      const cur = productAgg.get(it.productId) ?? { name: it.productName, qty: 0, revenue: 0 }
      cur.qty += it.quantity
      cur.revenue += it.quantity * it.unitPrice
      productAgg.set(it.productId, cur)
    }
  }
  const topProducts = [...productAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, 6)

  // ---- Desempenho por garçom ----
  const waiterAgg = new Map<string, { name: string; orders: number; revenue: number; responseSum: number; responseCount: number }>()
  for (const o of paidInTurn) {
    if (!o.waiter) continue
    const cur = waiterAgg.get(o.waiter.id) ?? { name: o.waiter.name, orders: 0, revenue: 0, responseSum: 0, responseCount: 0 }
    cur.orders += 1
    cur.revenue += o.total
    if (o.confirmedAt) {
      cur.responseSum += (o.confirmedAt.getTime() - o.createdAt.getTime()) / 60000
      cur.responseCount += 1
    }
    waiterAgg.set(o.waiter.id, cur)
  }
  const waiterPerformance = [...waiterAgg.values()]
    .map((w) => ({
      name: w.name.split(' ')[0],
      orders: w.orders,
      revenue: Math.round(w.revenue * 100) / 100,
      avgResponse: w.responseCount ? Math.round((w.responseSum / w.responseCount) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.orders - a.orders)

  // ---- Eficiência da cozinha (itens prontos no período) ----
  const readyItems = await db.orderItem.findMany({
    where: {
      status: { in: ['READY', 'SERVED'] },
      startedAt: { not: null },
      readyAt: { not: null },
      order: { status: 'PAID', paidAt: { gte: start } },
    },
    take: 800,
  })
  const itemsInTurn = readyItems.filter((it) => it.readyAt && inTurn(it.readyAt, turn))
  const kitchenAgg = new Map<string, { product: string; registered: number; actualSum: number; count: number }>()
  for (const it of itemsInTurn) {
    const cur = kitchenAgg.get(it.productName) ?? { product: it.productName, registered: it.prepTime, actualSum: 0, count: 0 }
    cur.actualSum += (it.readyAt!.getTime() - (it.startedAt?.getTime() ?? it.readyAt!.getTime())) / 60000
    cur.count += 1
    kitchenAgg.set(it.productName, cur)
  }
  const kitchenEfficiency = [...kitchenAgg.values()]
    .map((k) => ({
      product: k.product.length > 18 ? k.product.slice(0, 17) + '…' : k.product,
      registered: k.registered,
      actual: Math.round((k.actualSum / k.count) * 10) / 10,
      count: k.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // ---- Métodos de pagamento ----
  const payAgg = new Map<string, number>()
  for (const o of paidInTurn) {
    for (const p of o.payments) {
      payAgg.set(p.method, (payAgg.get(p.method) ?? 0) + o.total)
    }
  }

  return NextResponse.json({
    kpis: {
      occupiedTables,
      totalTables: tables.length,
      openOrders,
      avgService: Math.round(avgService),
      avgTicket: Math.round(avgTicket * 100) / 100,
      periodRevenue: Math.round(paidInTurn.reduce((a, o) => a + o.total, 0) * 100) / 100,
      periodOrders: paidInTurn.length,
    },
    revenueByDay: byDay,
    topProducts,
    waiterPerformance,
    kitchenEfficiency,
    payments: Object.fromEntries(payAgg),
  })
}

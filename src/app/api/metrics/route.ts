import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse } from '@/lib/api'

type Bucket = { key: string; label: string; revenue: number; orders: number }

function inTurn(date: Date, turn: string): boolean {
  const h = date.getHours()
  if (turn === 'morning') return h >= 6 && h < 12
  if (turn === 'afternoon') return h >= 12 && h < 18
  if (turn === 'night') return h >= 18 || h < 6
  return true
}

function parseLocalDate(s: string, endOfDay = false): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [, y, mo, d] = m
  return endOfDay
    ? new Date(Number(y), Number(mo) - 1, Number(d), 23, 59, 59, 999)
    : new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0)
}

/** GET /api/metrics?period=today|week|month|year|custom&from=&to=&days=&turn=
 *  Agregações do dashboard com granularidade automática (hora/dia/mês). */
export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth
  const sp = new URL(req.url).searchParams
  const period = sp.get('period') || 'week'
  const turn = sp.get('turn') || 'all'

  // ---- Janela do período ----
  let start: Date
  let end: Date = new Date()

  if (period === 'custom') {
    const from = parseLocalDate(sp.get('from') || '')
    const to = parseLocalDate(sp.get('to') || '', true)
    if (from && to) {
      start = from <= to ? from : to
      end = from <= to ? to : from
    } else {
      start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6)
    }
  } else {
    const daysMap: Record<string, number> = { today: 1, week: 7, month: 30, year: 365 }
    const days = daysMap[period] ?? Number(sp.get('days') || 7)
    start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
  }

  const spanMs = Math.max(end.getTime() - start.getTime(), 3600_000)
  const spanDays = spanMs / 86_400_000
  const granularity: 'hour' | 'day' | 'month' = spanDays <= 2 ? 'hour' : spanDays <= 62 ? 'day' : 'month'

  const paid = await db.order.findMany({
    where: { status: 'PAID', paidAt: { gte: start, lte: end } },
    include: {
      waiter: { select: { id: true, name: true } },
      payments: { select: { method: true } },
      items: { select: { productId: true, productName: true, quantity: true, unitPrice: true, station: true } },
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

  // ---- Série de faturamento (hora/dia/mês conforme o período) ----
  const buckets: Bucket[] = []
  if (granularity === 'hour') {
    for (let h = 0; h < 24; h++) {
      buckets.push({ key: String(h), label: `${String(h).padStart(2, '0')}h`, revenue: 0, orders: 0 })
    }
    for (const o of paidInTurn) {
      const b = buckets[o.paidAt!.getHours()]
      b.revenue += o.total
      b.orders += 1
    }
  } else if (granularity === 'day') {
    const cursor = new Date(start)
    while (cursor <= end) {
      const next = new Date(cursor)
      next.setDate(next.getDate() + 1)
      const rows = paidInTurn.filter((o) => o.paidAt && o.paidAt >= cursor && o.paidAt < next)
      buckets.push({
        key: cursor.toISOString().slice(0, 10),
        label: cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        revenue: Math.round(rows.reduce((a, o) => a + o.total, 0) * 100) / 100,
        orders: rows.length,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      const rows = paidInTurn.filter((o) => o.paidAt && o.paidAt >= cursor && o.paidAt < next)
      buckets.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        label: `${cursor.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} ${String(cursor.getFullYear()).slice(2)}`,
        revenue: Math.round(rows.reduce((a, o) => a + o.total, 0) * 100) / 100,
        orders: rows.length,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }
  for (const b of buckets) b.revenue = Math.round(b.revenue * 100) / 100

  // ---- Comandas por hora (agregado do período, p/ horários de pico) ----
  const byHour: Array<{ hour: number; label: string; revenue: number; orders: number }> = []
  for (let h = 0; h < 24; h++) byHour.push({ hour: h, label: `${String(h).padStart(2, '0')}h`, revenue: 0, orders: 0 })
  for (const o of paidInTurn) {
    const b = byHour[o.paidAt!.getHours()]
    b.revenue += o.total
    b.orders += 1
  }

  // ---- Por dia da semana + mapa de calor (dia × hora) ----
  const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const byWeekday = WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, revenue: 0, orders: 0 }))
  const heatmap: Array<{ weekday: number; hour: number; orders: number; revenue: number }> = []
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) heatmap.push({ weekday: w, hour: h, orders: 0, revenue: 0 })
  }
  for (const o of paidInTurn) {
    if (!o.paidAt) continue
    const w = o.paidAt.getDay()
    const h = o.paidAt.getHours()
    const wd = byWeekday[w]
    wd.revenue += o.total
    wd.orders += 1
    const cell = heatmap[w * 24 + h]
    cell.orders += 1
    cell.revenue += o.total
  }
  for (const w of byWeekday) w.revenue = Math.round(w.revenue * 100) / 100

  // ---- Período anterior (mesma duração, imediatamente anterior) ----
  // Consulta própria: `paid` contém apenas a janela atual, então o prev precisa buscar no banco.
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - spanMs)
  const prevPaid = await db.order.findMany({
    where: { status: 'PAID', paidAt: { gte: prevStart, lte: prevEnd } },
    select: { total: true, paidAt: true },
  })
  const prevInTurn = prevPaid.filter((o) => o.paidAt && inTurn(o.paidAt, turn))
  const prev = {
    revenue: Math.round(prevInTurn.reduce((a, o) => a + o.total, 0) * 100) / 100,
    orders: prevInTurn.length,
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
      product: k.product,
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

  // ---- Faturamento por estação ----
  const stationAgg = new Map<string, number>()
  for (const o of paidInTurn) {
    for (const it of o.items) {
      stationAgg.set(it.station, (stationAgg.get(it.station) ?? 0) + it.quantity * it.unitPrice)
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
    period: { key: period, granularity, start: start.toISOString(), end: end.toISOString() },
    prev,
    revenueSeries: buckets,
    byHour,
    byWeekday,
    heatmap,
    byStation: Object.fromEntries(stationAgg),
    topProducts,
    waiterPerformance,
    kitchenEfficiency,
    payments: Object.fromEntries(payAgg),
  })
}

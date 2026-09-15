import { NextRequest, NextResponse } from 'next/server'
import { ordersCol, tablesCol } from '@/lib/fs'
import { requireTenant, isResponse, type OrderDoc } from '@/lib/api'

type Bucket = { key: string; label: string; revenue: number; orders: number }
type PaidOrder = OrderDoc & { id: string; createdAt: Date; confirmedAt: Date | null; paidAt: Date }

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

function toDate(v: unknown): Date | null {
  const t = v as { toDate?: () => Date } | null
  return t?.toDate ? t.toDate() : null
}

/** GET /api/metrics?period=today|week|month|year|custom&from=&to=&days=&turn=
 *  Agregações do dashboard com granularidade automática (hora/dia/mês). */
export async function GET(req: NextRequest) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const estId = auth.establishmentId
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

  // Busca todas as comandas PAGAS do estabelecimento e filtra a janela em memória
  // (evita depender de índice composto status+paidAt; volume por tenant é modesto)
  const [allPaidSnap, allOrdersSnap, tablesSnap] = await Promise.all([
    ordersCol(estId).where('status', '==', 'PAID').get(),
    ordersCol(estId).where('status', 'in', ['PENDING_CONFIRM', 'IN_KITCHEN']).get(),
    tablesCol(estId).where('active', '==', true).get(),
  ])
  const allPaid: PaidOrder[] = allPaidSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }))
    .map((o) => ({ ...o, createdAt: toDate(o.createdAt) as Date, confirmedAt: toDate(o.confirmedAt), paidAt: toDate(o.paidAt) as Date }))
    .filter((o) => o.paidAt)

  const paid = allPaid.filter((o) => o.paidAt >= start && o.paidAt <= end)
  const paidInTurn = paid.filter((o) => inTurn(o.paidAt, turn))

  const openOrders = allOrdersSnap.size
  const tables = tablesSnap.docs.map((d) => d.data() as { status: string })
  const occupiedTables = tables.filter((t) => t.status === 'OCCUPIED').length

  const serviceTimes = paidInTurn
    .filter((o) => o.confirmedAt)
    .map((o) => (o.paidAt.getTime() - o.confirmedAt!.getTime()) / 60000)
  const avgService = serviceTimes.length ? serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length : 0
  const avgTicket = paidInTurn.length ? paidInTurn.reduce((a, o) => a + o.total, 0) / paidInTurn.length : 0

  // ---- Série de faturamento (hora/dia/mês conforme o período) ----
  const buckets: Bucket[] = []
  if (granularity === 'hour') {
    for (let h = 0; h < 24; h++) buckets.push({ key: String(h), label: `${String(h).padStart(2, '0')}h`, revenue: 0, orders: 0 })
    for (const o of paidInTurn) {
      const b = buckets[o.paidAt.getHours()]
      b.revenue += o.total
      b.orders += 1
    }
  } else if (granularity === 'day') {
    const cursor = new Date(start)
    while (cursor <= end) {
      const next = new Date(cursor)
      next.setDate(next.getDate() + 1)
      const rows = paidInTurn.filter((o) => o.paidAt >= cursor && o.paidAt < next)
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
      const rows = paidInTurn.filter((o) => o.paidAt >= cursor && o.paidAt < next)
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
    const b = byHour[o.paidAt.getHours()]
    b.revenue += o.total
    b.orders += 1
  }

  // ---- Por dia da semana + mapa de calor (dia × hora) ----
  const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const byWeekday = WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, revenue: 0, orders: 0 }))
  const heatmap: Array<{ weekday: number; hour: number; orders: number; revenue: number }> = []
  for (let w = 0; w < 7; w++) for (let h = 0; h < 24; h++) heatmap.push({ weekday: w, hour: h, orders: 0, revenue: 0 })
  for (const o of paidInTurn) {
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
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - spanMs)
  const prevPaid = allPaid.filter((o) => o.paidAt >= prevStart && o.paidAt <= prevEnd)
  const prevInTurn = prevPaid.filter((o) => inTurn(o.paidAt, turn))
  const prev = {
    revenue: Math.round(prevInTurn.reduce((a, o) => a + o.total, 0) * 100) / 100,
    orders: prevInTurn.length,
  }

  // ---- Produtos mais vendidos ----
  const productAgg = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const o of paidInTurn) {
    for (const it of o.items ?? []) {
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
    if (!o.waiterId || !o.waiterName) continue
    const cur = waiterAgg.get(o.waiterId) ?? { name: o.waiterName, orders: 0, revenue: 0, responseSum: 0, responseCount: 0 }
    cur.orders += 1
    cur.revenue += o.total
    if (o.confirmedAt) {
      cur.responseSum += (o.confirmedAt.getTime() - o.createdAt.getTime()) / 60000
      cur.responseCount += 1
    }
    waiterAgg.set(o.waiterId, cur)
  }
  const waiterPerformance = [...waiterAgg.values()]
    .map((w) => ({
      name: w.name.split(' ')[0],
      orders: w.orders,
      revenue: Math.round(w.revenue * 100) / 100,
      avgResponse: w.responseCount ? Math.round((w.responseSum / w.responseCount) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.orders - a.orders)

  // ---- Eficiência da cozinha (itens prontos das comandas pagas no período, com startedAt/readyAt) ----
  const kitchenAgg = new Map<string, { product: string; registered: number; actualSum: number; count: number }>()
  for (const o of paid.filter((x) => x.paidAt >= start)) {
    for (const it of o.items ?? []) {
      if (!['READY', 'SERVED'].includes(it.status)) continue
      const readyAt = toDate(it.readyAt)
      const startedAt = toDate(it.startedAt)
      if (!readyAt) continue
      if (!inTurn(readyAt, turn)) continue
      const cur = kitchenAgg.get(it.productName) ?? { product: it.productName, registered: it.prepTime, actualSum: 0, count: 0 }
      cur.actualSum += (readyAt.getTime() - (startedAt?.getTime() ?? readyAt.getTime())) / 60000
      cur.count += 1
      kitchenAgg.set(it.productName, cur)
    }
  }
  const kitchenEfficiency = [...kitchenAgg.values()]
    .map((k) => ({ product: k.product, registered: k.registered, actual: Math.round((k.actualSum / k.count) * 10) / 10, count: k.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // ---- Métodos de pagamento ----
  const payAgg = new Map<string, number>()
  for (const o of paidInTurn) {
    if (o.payment) payAgg.set(o.payment.method, (payAgg.get(o.payment.method) ?? 0) + o.total)
  }

  // ---- Faturamento por estação ----
  const stationAgg = new Map<string, number>()
  for (const o of paidInTurn) {
    for (const it of o.items ?? []) stationAgg.set(it.station, (stationAgg.get(it.station) ?? 0) + it.quantity * it.unitPrice)
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

import { NextRequest, NextResponse } from 'next/server'
import { qrLookupCol, tablesCol, ordersCol } from '@/lib/fs'
import { serializeOrder, type OrderDoc } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ token: string }> }

function toMillis(v: unknown): number {
  return (v as { toMillis?: () => number })?.toMillis?.() ?? 0
}

/**
 * API pública da tela do cliente (QR Code da mesa — sem login).
 * GET  → dados da mesa + comanda ativa
 * POST → { action: 'finish', orderId } encerra consumo e envia ao caixa
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const lookupSnap = await qrLookupCol().doc(token).get()
  if (!lookupSnap.exists) return NextResponse.json({ error: 'Mesa não encontrada. Chame um funcionário.' }, { status: 404 })
  const { establishmentId: estId, tableId } = lookupSnap.data() as { establishmentId: string; tableId: string }

  const tableSnap = await tablesCol(estId).doc(tableId).get()
  const table = tableSnap.data() as { number: number; capacity: number; active: boolean; status: string } | undefined
  if (!tableSnap.exists) return NextResponse.json({ error: 'Mesa não encontrada. Chame um funcionário.' }, { status: 404 })
  if (!table?.active) return NextResponse.json({ error: 'Mesa desativada. Chame um funcionário.' }, { status: 403 })

  const orders = ordersCol(estId)
  const [activeSnap, paidSnap] = await Promise.all([
    orders.where('tableId', '==', tableId).where('status', 'in', ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']).get(),
    orders.where('tableId', '==', tableId).where('status', '==', 'PAID').get(),
  ])
  const active = activeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) })).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))[0]
  const lastPaid = paidSnap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) })).sort((a, b) => toMillis(b.paidAt) - toMillis(a.paidAt))[0]

  return NextResponse.json({
    table: { id: tableId, number: table.number, capacity: table.capacity, status: table.status },
    order: active ? serializeOrder(active) : null,
    lastPaid: lastPaid ? serializeOrder(lastPaid) : null,
  })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const lookupSnap = await qrLookupCol().doc(token).get()
  if (!lookupSnap.exists) return NextResponse.json({ error: 'Mesa indisponível' }, { status: 403 })
  const { establishmentId: estId, tableId } = lookupSnap.data() as { establishmentId: string; tableId: string }
  const tableSnap = await tablesCol(estId).doc(tableId).get()
  const table = tableSnap.data() as { number: number; active: boolean } | undefined
  if (!tableSnap.exists || !table?.active) return NextResponse.json({ error: 'Mesa indisponível' }, { status: 403 })

  let body: { action?: string; orderId?: string; rating?: number } = {}
  try {
    body = (await req.json()) as { action?: string; orderId?: string; rating?: number }
  } catch {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  const orders = ordersCol(estId)

  // Avaliação da experiência — só é aceita APÓS o pagamento confirmado no caixa
  if (body.action === 'rate' && body.orderId) {
    const rating = Math.round(Number(body.rating))
    if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'Escolha de 1 a 5 estrelas' }, { status: 400 })
    const ref = orders.doc(body.orderId)
    const snap = await ref.get()
    const order = snap.data() as OrderDoc | undefined
    if (!snap.exists || order?.tableId !== tableId) return NextResponse.json({ error: 'Comanda inválida' }, { status: 404 })
    if (order.status !== 'PAID') return NextResponse.json({ error: 'Avaliação disponível após o pagamento' }, { status: 409 })

    await ref.update({ rating, ratedAt: new Date() })
    broadcast('comanda:avaliada', { orderId: body.orderId, code: order.code, tableNumber: table.number, rating }, 'dashboard')
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'finish' && body.orderId) {
    const ref = orders.doc(body.orderId)
    const snap = await ref.get()
    const order = snap.exists ? { id: body.orderId, ...(snap.data() as OrderDoc) } : null
    if (!order || order.tableId !== tableId) return NextResponse.json({ error: 'Comanda inválida' }, { status: 404 })
    if (order.status !== 'IN_KITCHEN') return NextResponse.json({ error: 'Comanda não pode ser encerrada agora' }, { status: 409 })

    const finishedAt = new Date()
    const items = order.items.map((it) => (it.status === 'PENDING' ? { ...it, status: 'SERVED', servedAt: finishedAt } : it))
    await ref.update({ status: 'AWAITING_PAYMENT', finishedAt, items })
    await tablesCol(estId).doc(tableId).update({ status: 'AWAITING_PAYMENT' })

    broadcast('comanda:encaminhada', { orderId: order.id, code: order.code, tableNumber: table.number, total: order.total }, 'cashier')
    broadcast('item:atualizado', { orderId: order.id, status: 'AWAITING_PAYMENT' }, `client:${order.id}`)
    broadcast('comanda:encaminhada', { orderId: order.id }, 'waiters')
    broadcast('comanda:encaminhada', { orderId: order.id }, 'dashboard')
    broadcast('mesa:atualizada', { tableId })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}

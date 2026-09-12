import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeOrder } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ token: string }> }

/**
 * API pública da tela do cliente (QR Code da mesa — sem login).
 * GET  → dados da mesa + comanda ativa
 * POST → { action: 'finish', orderId } encerra consumo e envia ao caixa
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const table = await db.restaurantTable.findUnique({ where: { qrToken: token } })
  if (!table) return NextResponse.json({ error: 'Mesa não encontrada. Chame um funcionário.' }, { status: 404 })
  if (!table.active) return NextResponse.json({ error: 'Mesa desativada. Chame um funcionário.' }, { status: 403 })

  const order = await db.order.findFirst({
    where: { tableId: table.id, status: { in: ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT'] } },
    include: {
      waiter: { select: { name: true } },
      items: { include: { product: { select: { emoji: true } } }, orderBy: { id: 'asc' } },
      payments: { select: { method: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const lastPaid = await db.order.findFirst({
    where: { tableId: table.id, status: 'PAID' },
    orderBy: { paidAt: 'desc' },
    include: { items: { include: { product: { select: { emoji: true } } } } },
  })

  return NextResponse.json({
    table: { id: table.id, number: table.number, capacity: table.capacity, status: table.status },
    order: order ? serializeOrder(order) : null,
    lastPaid: lastPaid ? serializeOrder(lastPaid) : null,
  })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const table = await db.restaurantTable.findUnique({ where: { qrToken: token } })
  if (!table || !table.active) return NextResponse.json({ error: 'Mesa indisponível' }, { status: 403 })

  let body: { action?: string; orderId?: string } = {}
  try {
    body = (await req.json()) as { action?: string; orderId?: string }
  } catch {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  if (body.action === 'finish' && body.orderId) {
    const order = await db.order.findUnique({ where: { id: body.orderId }, include: { table: { select: { number: true } } } })
    if (!order || order.tableId !== table.id) return NextResponse.json({ error: 'Comanda inválida' }, { status: 404 })
    if (order.status !== 'IN_KITCHEN') return NextResponse.json({ error: 'Comanda não pode ser encerrada agora' }, { status: 409 })

    await db.orderItem.updateMany({
      where: { orderId: order.id, status: 'PENDING' },
      data: { status: 'SERVED', servedAt: new Date() },
    })
    await db.order.update({
      where: { id: order.id },
      data: { status: 'AWAITING_PAYMENT', finishedAt: new Date() },
    })
    await db.restaurantTable.update({ where: { id: table.id }, data: { status: 'AWAITING_PAYMENT' } })

    broadcast('comanda:encaminhada', { orderId: order.id, code: order.code, tableNumber: table.number, total: order.total }, 'cashier')
    broadcast('item:atualizado', { orderId: order.id, status: 'AWAITING_PAYMENT' }, `client:${order.id}`)
    broadcast('comanda:encaminhada', { orderId: order.id }, 'waiters')
    broadcast('comanda:encaminhada', { orderId: order.id }, 'dashboard')
    broadcast('mesa:atualizada', { tableId: table.id })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}

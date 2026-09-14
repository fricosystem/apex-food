import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad, serializeOrder } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string; itemId: string }> }

/** Transição de status de um item: start | ready | served */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const { id, itemId } = await params
  const body = await readJson<{ action?: 'start' | 'ready' | 'served' }>(req)
  const action = body?.action

  const item = await db.orderItem.findUnique({ where: { id: itemId }, include: { order: { include: { table: true } } } })
  if (!item || item.orderId !== id) return bad('Item não encontrado', 404)
  // Isolamento: a comanda precisa pertencer ao estabelecimento do usuário
  if (item.order.establishmentId !== auth.establishmentId) return bad('Item não encontrado', 404)
  if (!['IN_KITCHEN', 'AWAITING_PAYMENT'].includes(item.order.status)) {
    return bad('Comanda não está em operação')
  }

  const now = new Date()
  let readyNotif = false

  if (action === 'start') {
    if (item.status !== 'PENDING') return bad('Item já está em preparo')
    await db.orderItem.update({ where: { id: itemId }, data: { status: 'IN_PREPARATION', startedAt: now } })
  } else if (action === 'ready') {
    if (!['PENDING', 'IN_PREPARATION'].includes(item.status)) return bad('Item não pode ser marcado como pronto')
    await db.orderItem.update({ where: { id: itemId }, data: { status: 'READY', startedAt: item.startedAt ?? now, readyAt: now } })
    readyNotif = true
  } else if (action === 'served') {
    if (item.status !== 'READY') return bad('Item precisa estar pronto antes de ser servido')
    await db.orderItem.update({ where: { id: itemId }, data: { status: 'SERVED', servedAt: now } })
  } else {
    return bad('Ação inválida')
  }

  const order = await db.order.findUnique({
    where: { id },
    include: {
      table: { select: { number: true } },
      waiter: { select: { name: true } },
      items: { include: { product: { select: { emoji: true } } } },
      payments: { select: { method: true } },
    },
  })

  // Notificações
  broadcast('item:atualizado', { orderId: id, itemId, action }, 'kitchen')
  broadcast('item:atualizado', { orderId: id, itemId, action }, `client:${id}`)
  if (readyNotif) {
    broadcast('comanda:pronta', {
      orderId: id,
      tableNumber: item.order.table.number,
      productName: item.productName,
      waiterId: order?.waiterId,
    }, 'waiters')
  }
  if (action === 'served') {
    broadcast('item:atualizado', { orderId: id }, 'waiters')
  }

  return NextResponse.json({ order: order ? serializeOrder(order) : null })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad, serializeOrder } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }

type ActionBody = { action?: 'assign' | 'confirm' | 'finish' | 'pay' | 'cancel'; method?: string; waiterId?: string }

const ACTIVE_STATUSES = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    include: {
      table: { select: { number: true } },
      waiter: { select: { name: true } },
      items: { include: { product: { select: { emoji: true } } } },
      payments: { select: { method: true } },
    },
  })
  if (!order || order.establishmentId !== auth.establishmentId) return bad('Comanda não encontrada', 404)
  return NextResponse.json({ order: serializeOrder(order) })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<ActionBody>(req)
  const action = body?.action

  const order = await db.order.findUnique({
    where: { id },
    include: { table: true, items: true },
  })
  if (!order || order.establishmentId !== auth.establishmentId) return bad('Comanda não encontrada', 404)

  // ---------- Assumir comanda (garçom atribui a si) ----------
  if (action === 'assign') {
    if (!ACTIVE_STATUSES.includes(order.status)) return bad('Comanda não está mais ativa')
    const target = auth.role === 'WAITER' ? auth.id : body?.waiterId || order.waiterId
    if (!target) return bad('Garçom inválido')
    // O garçom precisa pertencer ao mesmo estabelecimento da comanda
    const targetUser = await db.user.findUnique({ where: { id: target }, select: { establishmentId: true, role: true } })
    if (!targetUser || targetUser.establishmentId !== auth.establishmentId || !['WAITER', 'ADMIN', 'MANAGER'].includes(targetUser.role)) {
      return bad('Garçom inválido')
    }
    const updated = await db.order.update({
      where: { id },
      data: { waiterId: target },
      include: {
        table: { select: { number: true } },
        waiter: { select: { name: true } },
        items: { include: { product: { select: { emoji: true } } } },
        payments: { select: { method: true } },
      },
    })
    broadcast('item:atualizado', { orderId: id }, 'waiters')
    broadcast('item:atualizado', { orderId: id }, `client:${id}`)
    return NextResponse.json({ order: serializeOrder(updated) })
  }

  // ---------- Confirmar comanda → envia para a cozinha ----------
  if (action === 'confirm') {
    if (order.status !== 'PENDING_CONFIRM') return bad('Comanda já foi confirmada')
    let waiterId = order.waiterId
    if (auth.role === 'WAITER' && !waiterId) waiterId = auth.id
    const updated = await db.order.update({
      where: { id },
      data: { status: 'IN_KITCHEN', confirmedAt: new Date(), waiterId },
      include: {
        table: { select: { number: true } },
        waiter: { select: { name: true } },
        items: { include: { product: { select: { emoji: true } } } },
        payments: { select: { method: true } },
      },
    })
    broadcast('comanda:confirmada', { orderId: id, tableNumber: order.table.number }, 'kitchen')
    broadcast('item:atualizado', { orderId: id, status: 'IN_KITCHEN' }, `client:${id}`)
    broadcast('comanda:confirmada', { orderId: id }, 'waiters')
    broadcast('comanda:confirmada', { orderId: id }, 'dashboard')
    return NextResponse.json({ order: serializeOrder(updated) })
  }

  // ---------- Cliente conclui consumo → vai para o caixa ----------
  if (action === 'finish') {
    if (order.status !== 'IN_KITCHEN') return bad('Comanda não pode ser encerrada agora')
    // itens pendentes que nunca entraram em preparo podem ser cancelados; os demais seguem
    await db.orderItem.updateMany({
      where: { orderId: id, status: 'PENDING' },
      data: { status: 'SERVED', servedAt: new Date() },
    })
    const updated = await db.order.update({
      where: { id },
      data: { status: 'AWAITING_PAYMENT', finishedAt: new Date() },
      include: {
        table: { select: { number: true } },
        waiter: { select: { name: true } },
        items: { include: { product: { select: { emoji: true } } } },
        payments: { select: { method: true } },
      },
    })
    await db.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'AWAITING_PAYMENT' } })
    broadcast('comanda:encaminhada', { orderId: id, code: order.code, tableNumber: order.table.number, total: order.total }, 'cashier')
    broadcast('item:atualizado', { orderId: id, status: 'AWAITING_PAYMENT' }, `client:${id}`)
    broadcast('comanda:encaminhada', { orderId: id }, 'waiters')
    broadcast('mesa:atualizada', { tableId: order.tableId })
    broadcast('comanda:encaminhada', { orderId: id }, 'dashboard')
    return NextResponse.json({ order: serializeOrder(updated) })
  }

  // ---------- Caixa confirma pagamento ----------
  if (action === 'pay') {
    const allowed = ['ADMIN', 'MANAGER', 'CASHIER']
    if (!allowed.includes(auth.role)) return bad('Apenas o caixa pode registrar pagamentos', 403)
    if (order.status !== 'AWAITING_PAYMENT') return bad('Comanda não está aguardando pagamento')
    const method = body?.method
    if (!method || !['CREDIT', 'DEBIT', 'PIX', 'CASH'].includes(method)) return bad('Selecione uma forma de pagamento válida')

    const [updated] = await db.$transaction([
      db.order.update({
        where: { id },
        data: { status: 'PAID', paidAt: new Date() },
        include: {
          table: { select: { number: true } },
          waiter: { select: { name: true } },
          items: { include: { product: { select: { emoji: true } } } },
          payments: { select: { method: true } },
        },
      }),
      db.payment.create({
        data: { orderId: id, method, amount: order.total, cashierId: auth.id },
      }),
      db.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'FREE' } }),
    ])
    broadcast('comanda:paga', { orderId: id, code: order.code, tableNumber: order.table.number, total: order.total, method })
    broadcast('mesa:atualizada', { tableId: order.tableId })
    return NextResponse.json({ order: serializeOrder(updated) })
  }

  // ---------- Cancelamento (admin/gerente) ----------
  if (action === 'cancel') {
    if (!['ADMIN', 'MANAGER'].includes(auth.role)) return bad('Sem permissão para cancelar comandas', 403)
    if (!ACTIVE_STATUSES.includes(order.status)) return bad('Comanda não pode mais ser cancelada')
    const updated = await db.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        table: { select: { number: true } },
        waiter: { select: { name: true } },
        items: { include: { product: { select: { emoji: true } } } },
        payments: { select: { method: true } },
      },
    })
    if (order.status !== 'AWAITING_PAYMENT') {
      await db.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'FREE' } })
    }
    broadcast('mesa:atualizada', { tableId: order.tableId })
    broadcast('item:atualizado', { orderId: id }, `client:${id}`)
    return NextResponse.json({ order: serializeOrder(updated) })
  }

  return bad('Ação inválida')
}

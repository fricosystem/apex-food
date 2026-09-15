import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { ordersCol, tablesCol, usersCol } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad, serializeOrder, type OrderDoc } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }
type ActionBody = { action?: 'assign' | 'confirm' | 'finish' | 'pay' | 'cancel'; method?: string; waiterId?: string }
const ACTIVE_STATUSES = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const { id } = await params
  const snap = await ordersCol(auth.establishmentId).doc(id).get()
  if (!snap.exists) return bad('Comanda não encontrada', 404)
  return NextResponse.json({ order: serializeOrder({ id, ...(snap.data() as OrderDoc) }) })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<ActionBody>(req)
  const action = body?.action
  const ref = ordersCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Comanda não encontrada', 404)
  const order = { id, ...(snap.data() as OrderDoc) }

  // ---------- Assumir comanda (garçom atribui a si) ----------
  if (action === 'assign') {
    if (!ACTIVE_STATUSES.includes(order.status)) return bad('Comanda não está mais ativa')
    const target = auth.role === 'WAITER' ? auth.id : body?.waiterId || order.waiterId
    if (!target) return bad('Garçom inválido')
    const targetSnap = await usersCol().doc(target).get()
    const targetUser = targetSnap.data() as { establishmentId?: string; role?: string; name?: string } | undefined
    if (!targetSnap.exists || targetUser?.establishmentId !== auth.establishmentId || !['WAITER', 'ADMIN', 'MANAGER'].includes(targetUser?.role ?? '')) {
      return bad('Garçom inválido')
    }
    await ref.update({ waiterId: target, waiterName: targetUser?.name ?? null })
    broadcast('item:atualizado', { orderId: id }, 'waiters')
    broadcast('item:atualizado', { orderId: id }, `client:${id}`)
    return NextResponse.json({ order: serializeOrder({ ...order, waiterId: target, waiterName: targetUser?.name ?? null }) })
  }

  // ---------- Confirmar comanda → envia para a cozinha ----------
  if (action === 'confirm') {
    if (order.status !== 'PENDING_CONFIRM') return bad('Comanda já foi confirmada')
    let waiterId = order.waiterId
    let waiterName = order.waiterName
    if (auth.role === 'WAITER' && !waiterId) { waiterId = auth.id; waiterName = auth.name }
    const confirmedAt = new Date()
    await ref.update({ status: 'IN_KITCHEN', confirmedAt, waiterId, waiterName })
    broadcast('comanda:confirmada', { orderId: id, tableNumber: order.tableNumber }, 'kitchen')
    broadcast('item:atualizado', { orderId: id, status: 'IN_KITCHEN' }, `client:${id}`)
    broadcast('comanda:confirmada', { orderId: id }, 'waiters')
    broadcast('comanda:confirmada', { orderId: id }, 'dashboard')
    return NextResponse.json({ order: serializeOrder({ ...order, status: 'IN_KITCHEN', confirmedAt, waiterId, waiterName }) })
  }

  // ---------- Cliente conclui consumo → vai para o caixa ----------
  if (action === 'finish') {
    if (order.status !== 'IN_KITCHEN') return bad('Comanda não pode ser encerrada agora')
    const finishedAt = new Date()
    // itens pendentes que nunca entraram em preparo podem ser cancelados; os demais seguem
    const items = order.items.map((it) => (it.status === 'PENDING' ? { ...it, status: 'SERVED', servedAt: finishedAt } : it))
    await ref.update({ status: 'AWAITING_PAYMENT', finishedAt, items })
    await tablesCol(auth.establishmentId).doc(order.tableId).update({ status: 'AWAITING_PAYMENT' })
    broadcast('comanda:encaminhada', { orderId: id, code: order.code, tableNumber: order.tableNumber, total: order.total }, 'cashier')
    broadcast('item:atualizado', { orderId: id, status: 'AWAITING_PAYMENT' }, `client:${id}`)
    broadcast('comanda:encaminhada', { orderId: id }, 'waiters')
    broadcast('mesa:atualizada', { tableId: order.tableId })
    broadcast('comanda:encaminhada', { orderId: id }, 'dashboard')
    return NextResponse.json({ order: serializeOrder({ ...order, status: 'AWAITING_PAYMENT', finishedAt, items }) })
  }

  // ---------- Caixa confirma pagamento ----------
  if (action === 'pay') {
    const allowed = ['ADMIN', 'MANAGER', 'CASHIER']
    if (!allowed.includes(auth.role)) return bad('Apenas o caixa pode registrar pagamentos', 403)
    if (order.status !== 'AWAITING_PAYMENT') return bad('Comanda não está aguardando pagamento')
    const method = body?.method
    if (!method || !['CREDIT', 'DEBIT', 'PIX', 'CASH'].includes(method)) return bad('Selecione uma forma de pagamento válida')

    const paidAt = new Date()
    const payment = { method, amount: order.total, cashierId: auth.id, createdAt: paidAt }
    await adminDb.runTransaction(async (tx) => {
      tx.update(ref, { status: 'PAID', paidAt, payment })
      tx.update(tablesCol(auth.establishmentId).doc(order.tableId), { status: 'FREE' })
    })
    broadcast('comanda:paga', { orderId: id, code: order.code, tableNumber: order.tableNumber, total: order.total, method })
    broadcast('mesa:atualizada', { tableId: order.tableId })
    return NextResponse.json({ order: serializeOrder({ ...order, status: 'PAID', paidAt, payment }) })
  }

  // ---------- Cancelamento (admin/gerente) ----------
  if (action === 'cancel') {
    if (!['ADMIN', 'MANAGER'].includes(auth.role)) return bad('Sem permissão para cancelar comandas', 403)
    if (!ACTIVE_STATUSES.includes(order.status)) return bad('Comanda não pode mais ser cancelada')
    await ref.update({ status: 'CANCELLED' })
    if (order.status !== 'AWAITING_PAYMENT') {
      await tablesCol(auth.establishmentId).doc(order.tableId).update({ status: 'FREE' })
    }
    broadcast('mesa:atualizada', { tableId: order.tableId })
    broadcast('item:atualizado', { orderId: id }, `client:${id}`)
    return NextResponse.json({ order: serializeOrder({ ...order, status: 'CANCELLED' }) })
  }

  return bad('Ação inválida')
}

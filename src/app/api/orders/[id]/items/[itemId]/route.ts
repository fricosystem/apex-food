import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { ordersCol } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad, serializeOrder, type OrderDoc, type OrderItemRow } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string; itemId: string }> }

/**
 * Remoção de item da comanda — EXCLUSIVA da equipe (garçom/admin/gerente).
 * O cliente não tem este endpoint: itens enviados à cozinha só saem da comanda
 * por um funcionário, sempre com confirmação explícita no app.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const { id, itemId } = await params
  const ref = ordersCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Item não encontrado', 404)
  const order = { id, ...(snap.data() as OrderDoc) }
  const item = order.items.find((it) => it.id === itemId)
  if (!item) return bad('Item não encontrado', 404)
  // A conta só pode ser alterada enquanto a comanda não chegou ao caixa
  if (!['PENDING_CONFIRM', 'IN_KITCHEN'].includes(order.status)) {
    return bad('Comanda encaminhada ao caixa — o item não pode mais ser removido')
  }

  const remaining = order.items.filter((it) => it.id !== itemId)
  const newTotal = Math.round(remaining.reduce((a, it) => a + it.unitPrice * it.quantity, 0) * 100) / 100
  await ref.update({ items: remaining, total: newTotal })

  broadcast('item:atualizado', { orderId: id, itemId, action: 'removed' }, 'waiters')
  broadcast('item:atualizado', { orderId: id, itemId, action: 'removed' }, 'kitchen')
  broadcast('item:atualizado', { orderId: id, itemId, action: 'removed' }, 'dashboard')
  broadcast('item:atualizado', { orderId: id, itemId, action: 'removed' }, `client:${id}`)
  broadcast('mesa:atualizada', { tableId: order.tableId })

  return NextResponse.json({ order: serializeOrder({ ...order, items: remaining, total: newTotal }) })
}

/** Transição de status de um item: start | ready | served */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const { id, itemId } = await params
  const body = await readJson<{ action?: 'start' | 'ready' | 'served' }>(req)
  const action = body?.action
  const ref = ordersCol(auth.establishmentId).doc(id)

  let updatedOrder: OrderDoc & { id: string }
  let readyNotif = false
  let notifItem: OrderItemRow

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw Object.assign(new Error('Item não encontrado'), { status: 404 })
      const order = { id, ...(snap.data() as OrderDoc) }
      const item = order.items.find((it) => it.id === itemId)
      if (!item) throw Object.assign(new Error('Item não encontrado'), { status: 404 })
      if (!['IN_KITCHEN', 'AWAITING_PAYMENT'].includes(order.status)) {
        throw Object.assign(new Error('Comanda não está em operação'), { status: 400 })
      }

      const now = new Date()
      let newItem: OrderItemRow
      let ready = false
      if (action === 'start') {
        if (item.status !== 'PENDING') throw Object.assign(new Error('Item já está em preparo'), { status: 400 })
        newItem = { ...item, status: 'IN_PREPARATION', startedAt: now }
      } else if (action === 'ready') {
        if (!['PENDING', 'IN_PREPARATION'].includes(item.status)) throw Object.assign(new Error('Item não pode ser marcado como pronto'), { status: 400 })
        newItem = { ...item, status: 'READY', startedAt: item.startedAt ?? now, readyAt: now }
        ready = true
      } else if (action === 'served') {
        if (item.status !== 'READY') throw Object.assign(new Error('Item precisa estar pronto antes de ser servido'), { status: 400 })
        newItem = { ...item, status: 'SERVED', servedAt: now }
      } else {
        throw Object.assign(new Error('Ação inválida'), { status: 400 })
      }

      const items = order.items.map((it) => (it.id === itemId ? newItem : it))
      tx.update(ref, { items })
      return { order: { ...order, items }, ready, newItem }
    })
    updatedOrder = result.order
    readyNotif = result.ready
    notifItem = result.newItem
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message || 'Não foi possível atualizar o item' }, { status: err.status ?? 500 })
  }

  broadcast('item:atualizado', { orderId: id, itemId, action }, 'kitchen')
  broadcast('item:atualizado', { orderId: id, itemId, action }, `client:${id}`)
  if (readyNotif && notifItem) {
    broadcast('comanda:pronta', {
      orderId: id, tableNumber: updatedOrder.tableNumber, productName: notifItem.productName, waiterId: updatedOrder.waiterId,
    }, 'waiters')
  }
  if (action === 'served') {
    broadcast('item:atualizado', { orderId: id }, 'waiters')
  }

  return NextResponse.json({ order: serializeOrder(updatedOrder) })
}

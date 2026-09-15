import { NextRequest, NextResponse } from 'next/server'
import { ordersCol, tablesCol, productsCol, categoriesCol, qrLookupCol, countDocs } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad, serializeOrder, type OrderDoc } from '@/lib/api'
import { broadcast } from '@/lib/realtime'
import { pickWaiter, getSetting } from '@/lib/distribution'

type OrderRow = OrderDoc & { id: string; establishmentId?: string }

function toMillis(v: unknown): number {
  return (v as { toMillis?: () => number })?.toMillis?.() ?? 0
}

/** Lista comandas com filtros por papel do usuário */
export async function GET(req: NextRequest) {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const sp = new URL(req.url).searchParams
  const statusParam = sp.get('status') // csv
  const waiterId = sp.get('waiterId')
  const tableId = sp.get('tableId')
  const from = sp.get('from')
  const to = sp.get('to')
  const limit = Math.min(500, Math.max(1, Number(sp.get('limit') || 200)))

  let query = ordersCol(auth.establishmentId) as import('firebase-admin/firestore').Query
  if (statusParam) query = query.where('status', 'in', statusParam.split(','))
  if (tableId) query = query.where('tableId', '==', tableId)
  // Trim por papel + filtro de garçom são resolvidos em memória abaixo (evita precisar de
  // índices compostos para uma consulta OR — volume por estabelecimento é pequeno)

  const snap = await query.get()
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderRow)

  if (waiterId) rows = rows.filter((o) => o.waiterId === waiterId)
  if (auth.role === 'WAITER') rows = rows.filter((o) => o.waiterId === auth.id || !o.waiterId)
  if (from) { const t = new Date(from).getTime(); rows = rows.filter((o) => toMillis(o.createdAt) >= t) }
  if (to) { const t = new Date(to).getTime(); rows = rows.filter((o) => toMillis(o.createdAt) <= t) }

  rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  rows = rows.slice(0, limit)

  return NextResponse.json({ orders: rows.map(serializeOrder) })
}

type CreateBody = {
  tableToken?: string
  items?: Array<{ productId?: string; quantity?: number; notes?: string }>
}

/** Cliente envia a comanda a partir do cardápio (QR da mesa) */
export async function POST(req: NextRequest) {
  const body = await readJson<CreateBody>(req)
  const token = body?.tableToken
  const items = (body?.items ?? []).filter((i) => i.productId && (i.quantity ?? 0) > 0)
  if (!token) return bad('Mesa não identificada')
  if (items.length === 0) return bad('Comanda vazia — adicione itens antes de enviar')

  const lookupSnap = await qrLookupCol().doc(token).get()
  if (!lookupSnap.exists) return bad('Mesa indisponível. Chame um funcionário.', 404)
  const { establishmentId: estId, tableId } = lookupSnap.data() as { establishmentId: string; tableId: string }

  const tableRef = tablesCol(estId).doc(tableId)
  const tableSnap = await tableRef.get()
  const table = tableSnap.data() as { number: number; active: boolean } | undefined
  if (!tableSnap.exists || !table?.active) return bad('Mesa indisponível. Chame um funcionário.', 404)

  const orders = ordersCol(estId)
  const openSnap = await orders.where('tableId', '==', tableId).where('status', 'in', ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']).get()
  const openOrders = openSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...(d.data() as OrderDoc) }))
  openOrders.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  const openOrder = openOrders[0]
  // Comanda encaminhada ao caixa não recebe mais itens — o cliente deve aguardar o fechamento
  if (openOrder && openOrder.status === 'AWAITING_PAYMENT') {
    return bad('A comanda já foi encaminhada ao caixa. Chame o garçom para pedir mais.', 409)
  }

  const productSnaps = await Promise.all(items.map((i) => productsCol(estId).doc(i.productId!).get()))
  const products = productSnaps
    .filter((s) => s.exists && (s.data() as { active: boolean }).active)
    .map((s) => ({ id: s.id, ...(s.data() as Record<string, unknown>) }) as { id: string; price: number; prepTime: number; name: string; emoji: string; categoryId: string })
  if (products.length === 0) return bad('Produtos indisponíveis')

  // station vem da categoria do produto
  const catIds = [...new Set(products.map((p) => p.categoryId))]
  const catSnaps = await Promise.all(catIds.map((id) => categoriesCol(estId).doc(id).get()))
  const sectorByCat = new Map(catSnaps.filter((s) => s.exists).map((s) => [s.id, (s.data() as { sector?: string }).sector ?? 'KITCHEN']))

  let total = 0
  const itemRows = items.map((i) => {
    const p = products.find((x) => x.id === i.productId)!
    const qty = Math.max(1, Math.min(20, Math.round(i.quantity ?? 1)))
    total += p.price * qty
    return {
      id: crypto.randomUUID(),
      productId: p.id,
      productName: p.name,
      quantity: qty,
      notes: (i.notes ?? '').slice(0, 300),
      unitPrice: p.price,
      station: sectorByCat.get(p.categoryId) ?? 'KITCHEN',
      prepTime: p.prepTime,
      status: 'PENDING',
      startedAt: null,
      readyAt: null,
      servedAt: null,
      emoji: p.emoji,
    }
  })

  // Marca os produtos como já utilizados (permite excluir produtos nunca pedidos; ver products/[id]/route.ts)
  await Promise.all(products.map((p) => productsCol(estId).doc(p.id).update({ everUsed: true })))

  // Pedido em cima de comanda aberta (Pedir mais): os itens são SOMADOS à comanda existente
  if (openOrder) {
    const newTotal = Math.round((openOrder.total + total) * 100) / 100
    const newItems = [...openOrder.items, ...itemRows]
    await orders.doc(openOrder.id).update({ items: newItems, total: newTotal })
    const updated: OrderRow = { ...openOrder, id: openOrder.id, items: newItems, total: newTotal }

    broadcast('comanda:itens', {
      orderId: updated.id, code: updated.code, tableNumber: table.number, waiterId: updated.waiterId,
      addedCount: items.reduce((a, i) => a + (i.quantity ?? 1), 0), total: updated.total,
    }, 'waiters')
    broadcast('item:atualizado', { orderId: updated.id, action: 'added' }, 'kitchen')
    broadcast('item:atualizado', { orderId: updated.id, action: 'added' }, `client:${updated.id}`)
    broadcast('comanda:itens', { orderId: updated.id, code: updated.code, tableNumber: table.number }, 'dashboard')
    broadcast('mesa:atualizada', { tableId })

    return NextResponse.json({ order: serializeOrder(updated) })
  }

  // Distribuição inteligente → garçom com menor carga (dentro do estabelecimento)
  const rule = await getSetting('distributionRule', 'least_active', estId)
  const waiterId = await pickWaiter(rule, estId)

  const seq = (await countDocs(orders)) + 1
  const now = new Date()
  const data: OrderDoc = {
    code: `C${String(seq).padStart(4, '0')}`,
    tableId,
    tableNumber: table.number,
    waiterId,
    waiterName: null,
    status: 'PENDING_CONFIRM',
    total: Math.round(total * 100) / 100,
    createdAt: now,
    confirmedAt: null,
    finishedAt: null,
    paidAt: null,
    rating: null,
    ratedAt: null,
    items: itemRows,
    payment: null,
  }
  const ref = await orders.add(data)
  await tableRef.update({ status: 'OCCUPIED' })

  broadcast('comanda:nova', { orderId: ref.id, code: data.code, tableNumber: table.number, waiterId }, 'waiters')
  broadcast('mesa:atualizada', { tableId })
  broadcast('comanda:nova', { orderId: ref.id, code: data.code }, 'dashboard')

  return NextResponse.json({ order: serializeOrder({ id: ref.id, ...data }) })
}

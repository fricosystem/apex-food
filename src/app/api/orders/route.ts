import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad, serializeOrder } from '@/lib/api'
import { broadcast } from '@/lib/realtime'
import { pickWaiter, getSetting } from '@/lib/distribution'

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
  const limit = Number(sp.get('limit') || 200)

  const where: Record<string, unknown> = { establishmentId: auth.establishmentId }
  if (statusParam) where.status = { in: statusParam.split(',') }
  if (waiterId) where.waiterId = waiterId
  if (tableId) where.tableId = tableId
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  // Trim por papel: garçom vê comandas próprias + fila não atribuída
  if (auth.role === 'WAITER') {
    where.OR = [{ waiterId: auth.id }, { waiterId: null }]
  }

  const orders = await db.order.findMany({
    where,
    include: {
      table: { select: { number: true } },
      waiter: { select: { name: true } },
      items: { include: { product: { select: { emoji: true } } }, orderBy: { id: 'asc' } },
      payments: { select: { method: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(500, Math.max(1, limit)),
  })

  return NextResponse.json({ orders: orders.map(serializeOrder) })
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

  const table = await db.restaurantTable.findUnique({ where: { qrToken: token } })
  if (!table || !table.active) return bad('Mesa indisponível. Chame um funcionário.', 404)
  const estId = table.establishmentId

  const openOrder = await db.order.findFirst({
    where: { tableId: table.id, status: { in: ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT'] } },
  })
  // Comanda encaminhada ao caixa não recebe mais itens — o cliente deve aguardar o fechamento
  if (openOrder && openOrder.status === 'AWAITING_PAYMENT') {
    return bad('A comanda já foi encaminhada ao caixa. Chame o garçom para pedir mais.', 409)
  }

  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId!) }, active: true, ...(estId ? { establishmentId: estId } : {}) },
  })
  if (products.length === 0) return bad('Produtos indisponíveis')

  let total = 0
  const itemRows = items.map((i) => {
    const p = products.find((x) => x.id === i.productId)!
    const qty = Math.max(1, Math.min(20, Math.round(i.quantity ?? 1)))
    total += p.price * qty
    return {
      productId: p.id,
      productName: p.name,
      quantity: qty,
      notes: (i.notes ?? '').slice(0, 300),
      unitPrice: p.price,
      station: 'KITCHEN', // placeholder — sobrescrito abaixo com o setor da categoria
      prepTime: p.prepTime,
    }
  })
  // station vem da categoria — buscar categorias
  const cats = await db.category.findMany({ where: { id: { in: products.map((p) => p.categoryId) } } })
  for (const row of itemRows) {
    const prod = products.find((x) => x.id === row.productId)!
    const cat = cats.find((c) => c.id === prod.categoryId)
    row.station = cat?.sector ?? 'KITCHEN'
  }

  // Pedido em cima de comanda aberta (Pedir mais): os itens são SOMADOS à comanda existente
  if (openOrder) {
    await db.orderItem.createMany({ data: itemRows.map((r) => ({ ...r, orderId: openOrder.id })) })

    const updated = await db.order.update({
      where: { id: openOrder.id },
      data: { total: Math.round((openOrder.total + total) * 100) / 100 },
      include: {
        table: { select: { number: true } },
        waiter: { select: { name: true } },
        items: { include: { product: { select: { emoji: true } } } },
        payments: { select: { method: true } },
      },
    })

    // Salão/atendimento + cliente acompanham a soma ao vivo
    broadcast('comanda:itens', {
      orderId: updated.id,
      code: updated.code,
      tableNumber: table.number,
      waiterId: updated.waiterId,
      addedCount: items.reduce((a, i) => a + (i.quantity ?? 1), 0),
      total: updated.total,
    }, 'waiters')
    broadcast('item:atualizado', { orderId: updated.id, action: 'added' }, 'kitchen')
    broadcast('item:atualizado', { orderId: updated.id, action: 'added' }, `client:${updated.id}`)
    broadcast('comanda:itens', { orderId: updated.id, code: updated.code, tableNumber: table.number }, 'dashboard')
    broadcast('mesa:atualizada', { tableId: table.id })

    return NextResponse.json({ order: serializeOrder(updated) })
  }

  // Distribuição inteligente → garçom com menor carga (dentro do estabelecimento)
  const rule = await getSetting('distributionRule', 'least_active', estId)
  const waiterId = await pickWaiter(rule, estId)

  const seq = (await db.order.count({ where: estId ? { establishmentId: estId } : {} })) + 1
  const order = await db.order.create({
    data: {
      code: `C${String(seq).padStart(4, '0')}`,
      tableId: table.id,
      waiterId,
      status: 'PENDING_CONFIRM',
      total: Math.round(total * 100) / 100,
      ...(estId ? { establishmentId: estId } : {}),
      items: { create: itemRows },
    },
    include: {
      table: { select: { number: true } },
      waiter: { select: { name: true } },
      items: { include: { product: { select: { emoji: true } } } },
      payments: { select: { method: true } },
    },
  })

  await db.restaurantTable.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } })

  broadcast('comanda:nova', { orderId: order.id, code: order.code, tableNumber: table.number, waiterId }, 'waiters')
  broadcast('mesa:atualizada', { tableId: table.id })
  broadcast('comanda:nova', { orderId: order.id, code: order.code }, 'dashboard')

  return NextResponse.json({ order: serializeOrder(order) })
}

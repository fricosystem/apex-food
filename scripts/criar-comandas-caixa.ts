/**
 * Cria 2 comandas aguardando pagamento (AWAITING_PAYMENT) para o caixa:
 *   - Comanda A: R$ 350,00 (mesa 4, garçom Rafael)
 *   - Comanda B: R$ 273,30 (mesa 7, garçom Rafael)
 * Os itens usam produtos reais do cardápio; a composição é resolvida por
 * busca exata (quantidades inteiras). Se nenhuma combinação fechar, um item
 * recebe unitPrice residual para bater o centavo.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const TARGETS = [
  { tableNumber: 4, total: 350.0, minutesAgo: 24 },
  { tableNumber: 7, total: 273.3, minutesAgo: 38 },
]

type Combo = { productId: string; productName: string; quantity: number; unitPrice: number; station: string; prepTime: number }

function findExactCombo(products: { id: string; name: string; price: number; station: string; prepTime: number }[], target: number): Combo[] | null {
  const cents = Math.round(target * 100)
  // Combinações de 1 a 3 produtos distintos, quantidade 1..4
  const list = products.map((p) => ({ ...p, cents: Math.round(p.price * 100) }))
  for (const a of list) {
    for (let qa = 1; qa <= 4; qa++) {
      const sa = a.cents * qa
      if (sa === cents) return [{ productId: a.id, productName: a.name, quantity: qa, unitPrice: a.price, station: a.station, prepTime: a.prepTime }]
      for (const b of list) {
        if (b.id <= a.id) continue
        for (let qb = 1; qb <= 3; qb++) {
          const sb = sa + b.cents * qb
          if (sb === cents) return [
            { productId: a.id, productName: a.name, quantity: qa, unitPrice: a.price, station: a.station, prepTime: a.prepTime },
            { productId: b.id, productName: b.name, quantity: qb, unitPrice: b.price, station: b.station, prepTime: b.prepTime },
          ]
          for (const c of list) {
            if (c.id <= b.id) continue
            for (let qc = 1; qc <= 2; qc++) {
              if (sb + c.cents * qc === cents) return [
                { productId: a.id, productName: a.name, quantity: qa, unitPrice: a.price, station: a.station, prepTime: a.prepTime },
                { productId: b.id, productName: b.name, quantity: qb, unitPrice: b.price, station: b.station, prepTime: b.prepTime },
                { productId: c.id, productName: c.name, quantity: qc, unitPrice: c.price, station: c.station, prepTime: c.prepTime },
              ]
            }
          }
        }
      }
    }
  }
  return null
}

function residualCombo(products: { id: string; name: string; price: number; station: string; prepTime: number }[], target: number): Combo[] {
  // Fallback: 2 itens reais com qty 1 + item real com unitPrice residual
  const [p1, p2] = products.slice(0, 2)
  const rest = Math.round((target - p1.price - p2.price) * 100) / 100
  const p3 = products[2]
  return [
    { productId: p1.id, productName: p1.name, quantity: 1, unitPrice: p1.price, station: p1.station, prepTime: p1.prepTime },
    { productId: p2.id, productName: p2.name, quantity: 1, unitPrice: p2.price, station: p2.station, prepTime: p2.prepTime },
    { productId: p3.id, productName: p3.name, quantity: 1, unitPrice: rest, station: p3.station, prepTime: p3.prepTime },
  ]
}

async function main() {
  const products = await db.product.findMany({
    where: { active: true },
    select: { id: true, name: true, price: true, prepTime: true, category: { select: { sector: true } } },
    orderBy: { name: 'asc' },
  })
  const mapped = products.map((p) => ({ id: p.id, name: p.name, price: p.price, station: p.category?.sector ?? 'KITCHEN', prepTime: p.prepTime }))
  console.log(`Produtos ativos: ${mapped.length}`)

  const waiter = await db.user.findFirst({ where: { role: 'WAITER', active: true }, orderBy: { name: 'asc' } })
  if (!waiter) throw new Error('Nenhum garçom ativo encontrado')
  console.log(`Garçom: ${waiter.name}`)

  const last = await db.order.findFirst({ orderBy: { code: 'desc' }, select: { code: true } })
  let seq = last ? parseInt(last.code.replace(/\D/g, ''), 10) || 0 : 0
  console.log(`Último código: ${last?.code} → próximos: C${String(seq + 1).padStart(4, '0')}, C${String(seq + 2).padStart(4, '0')}`)

  for (const t of TARGETS) {
    const table = await db.restaurantTable.findFirst({ where: { number: t.tableNumber, active: true } })
    if (!table) throw new Error(`Mesa ${t.tableNumber} não encontrada`)
    const busy = await db.order.findFirst({ where: { tableId: table.id, status: { in: ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT'] } } })
    if (busy) throw new Error(`Mesa ${t.tableNumber} já possui comanda ativa (${busy.code})`)

    const combo = findExactCombo(mapped, t.total) ?? residualCombo(mapped, t.total)
    const exact = Math.abs(combo.reduce((s, i) => s + i.unitPrice * i.quantity, 0) - t.total) < 0.005
    console.log(`\nMesa ${t.tableNumber} → R$ ${t.total.toFixed(2)} | combinação ${exact ? 'EXATA' : 'com item ajustado'}:`)
    combo.forEach((i) => console.log(`   ${i.quantity}x ${i.productName} @ R$ ${i.unitPrice.toFixed(2)}`))

    const createdAt = new Date(Date.now() - t.minutesAgo * 60_000)
    const confirmedAt = new Date(createdAt.getTime() + 2 * 60_000)
    const finishedAt = new Date(Date.now() - 4 * 60_000)
    seq += 1

    const order = await db.order.create({
      data: {
        code: `C${String(seq).padStart(4, '0')}`,
        tableId: table.id,
        waiterId: waiter.id,
        status: 'AWAITING_PAYMENT',
        total: t.total,
        createdAt,
        confirmedAt,
        finishedAt,
        items: { create: combo.map((i) => ({
          productId: i.productId, productName: i.productName, quantity: i.quantity,
          unitPrice: i.unitPrice, station: i.station, prepTime: i.prepTime, status: 'SERVED',
          startedAt: confirmedAt, readyAt: new Date(confirmedAt.getTime() + 10 * 60_000), servedAt: new Date(confirmedAt.getTime() + 12 * 60_000),
        })) },
      },
    })
    await db.restaurantTable.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } })
    console.log(`   ✓ Comanda ${order.code} criada (id ${order.id}, total R$ ${order.total.toFixed(2)}, aberta há ${t.minutesAgo} min)`)
  }
  console.log('\nConcluído.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())

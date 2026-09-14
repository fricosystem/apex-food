import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const TOKEN = '65l4aegk6fy8lhox' // Mesa 01

const table = await db.restaurantTable.findUnique({ where: { qrToken: TOKEN } })
if (!table) throw new Error('mesa nao encontrada')

// Cancela comandas abertas restantes e libera a mesa para o fluxo E2E completo
const cancelled = await db.order.updateMany({
  where: { tableId: table.id, status: { in: ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT'] } },
  data: { status: 'CANCELLED' },
})
await db.restaurantTable.update({ where: { id: table.id }, data: { status: 'FREE' } })

const rafael = await db.user.findFirst({ where: { email: 'rafael@apexfood.com' } })
const lastPaid = await db.order.findFirst({ where: { tableId: table.id, status: 'PAID' }, orderBy: { paidAt: 'desc' }, select: { code: true, rating: true } })

console.log(JSON.stringify({ table: table.number, cancelled: cancelled.count, rafaelId: rafael?.id ?? null, lastPaid }, null, 1))
await db.$disconnect()
process.exit(0)

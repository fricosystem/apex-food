import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const table = await db.restaurantTable.findUnique({ where: { qrToken: '65l4aegk6fy8lhox' } })
const o = await db.order.findFirst({ where: { tableId: table.id, status: { in: ['PENDING_CONFIRM','IN_KITCHEN'] } } })
if (o && o.status === 'PENDING_CONFIRM') {
  await db.order.update({ where: { id: o.id }, data: { status: 'IN_KITCHEN', confirmedAt: new Date() } })
  console.log(JSON.stringify({ ok: true, code: o.code }))
} else { console.log(JSON.stringify({ ok: false, status: o?.status ?? null })) }
await db.$disconnect(); process.exit(0)

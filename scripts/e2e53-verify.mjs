import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const rows = await db.order.findMany({ where: { rating: { not: null } }, select: { code: true, rating: true, ratedAt: true, status: true } })
console.log(JSON.stringify(rows))
await db.$disconnect(); process.exit(0)

/* Move 3 comandas pagas para 10 dias atrás — cria base de comparação da "semana anterior" */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // destino: 10 dias atrás 20h — dentro da janela "semana anterior" do dashboard
  const target = new Date()
  target.setDate(target.getDate() - 10)
  target.setHours(20, 0, 0, 0)

  const paid = await db.order.findMany({
    where: { status: 'PAID', paidAt: { gte: new Date(Date.now() - 6 * 86_400_000) } },
    orderBy: { paidAt: 'asc' },
    take: 3,
    select: { id: true, total: true },
  })
  if (paid.length === 0) {
    console.log('nenhuma comanda paga recente encontrada')
    return
  }
  for (const o of paid) {
    const created = new Date(target.getTime() - 20 * 60_000)
    await db.order.update({ where: { id: o.id }, data: { paidAt: target, confirmedAt: target, createdAt: created } })
    console.log(`comanda ${o.id} (R$ ${o.total}) movida para ${target.toISOString()}`)
  }
}

main().finally(() => db.$disconnect())

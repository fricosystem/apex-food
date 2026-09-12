import { db } from '@/lib/db'

/**
 * Distribuição inteligente de comandas.
 * Regras suportadas:
 *  - least_active: menor quantidade de comandas abertas no momento
 *  - least_load:   menor demanda acumulada (comandas abertas + itens em preparo no dia)
 * Retorna o id do garçom escolhido (ou null se não houver garçom disponível).
 */
export async function pickWaiter(rule: string = 'least_active'): Promise<string | null> {
  const waiters = await db.user.findMany({
    where: { role: 'WAITER', active: true },
    select: { id: true },
  })
  if (waiters.length === 0) return null

  const activeStatuses = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const scores = await Promise.all(
    waiters.map(async (w) => {
      const activeOrders = await db.order.count({
        where: { waiterId: w.id, status: { in: activeStatuses } },
      })
      let load = activeOrders
      if (rule === 'least_load') {
        const dayOrders = await db.order.count({
          where: { waiterId: w.id, createdAt: { gte: startOfDay } },
        })
        const preparingItems = await db.orderItem.count({
          where: { status: 'IN_PREPARATION', order: { waiterId: w.id } },
        })
        load = activeOrders * 2 + dayOrders + preparingItems
      }
      return { id: w.id, load }
    })
  )

  scores.sort((a, b) => a.load - b.load)
  return scores[0]?.id ?? null
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const s = await db.setting.findUnique({ where: { key } })
  return s?.value ?? fallback
}

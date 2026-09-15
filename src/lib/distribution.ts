import { usersCol, establishmentsCol, ordersCol, countDocs } from '@/lib/fs'

/**
 * Distribuição inteligente de comandas.
 * Regras suportadas:
 *  - least_active: menor quantidade de comandas abertas no momento
 *  - least_load:   menor demanda acumulada (comandas abertas + itens em preparo no dia)
 * Retorna o id do garçom escolhido (ou null se não houver garçom disponível).
 */
export async function pickWaiter(rule: string = 'least_active', establishmentId?: string | null): Promise<string | null> {
  if (!establishmentId) return null
  const waitersSnap = await usersCol()
    .where('establishmentId', '==', establishmentId)
    .where('role', '==', 'WAITER')
    .where('active', '==', true)
    .get()
  if (waitersSnap.empty) return null

  const activeStatuses = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const orders = ordersCol(establishmentId)

  const scores = await Promise.all(
    waitersSnap.docs.map(async (w) => {
      const activeOrders = await countDocs(
        orders.where('waiterId', '==', w.id).where('status', 'in', activeStatuses),
      )
      let load = activeOrders
      if (rule === 'least_load') {
        const dayOrders = await countDocs(orders.where('waiterId', '==', w.id).where('createdAt', '>=', startOfDay))
        // itens "em preparo" ficam embutidos no array `items` de cada comanda ativa —
        // aproximamos somando os itens IN_PREPARATION das comandas ativas já contadas acima
        const activeSnap = await orders.where('waiterId', '==', w.id).where('status', 'in', activeStatuses).get()
        const preparingItems = activeSnap.docs.reduce((sum, d) => {
          const items = (d.data().items ?? []) as Array<{ status: string }>
          return sum + items.filter((it) => it.status === 'IN_PREPARATION').length
        }, 0)
        load = activeOrders * 2 + dayOrders + preparingItems
      }
      return { id: w.id, load }
    }),
  )

  scores.sort((a, b) => a.load - b.load)
  return scores[0]?.id ?? null
}

export async function getSetting(key: string, fallback: string, establishmentId?: string | null): Promise<string> {
  if (!establishmentId) return fallback
  const snap = await establishmentsCol().doc(establishmentId).get()
  const settings = (snap.data()?.settings ?? {}) as Record<string, string>
  return settings[key] ?? fallback
}

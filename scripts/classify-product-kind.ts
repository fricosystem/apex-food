/**
 * Classificação one-off dos produtos existentes no novo campo `kind`:
 * - MEAL    → refeições (categorias de comida: setor KITCHEN / GRILL / PIZZERIA)
 * - PRODUCT → produtos em geral (categorias de bar: setor BAR, ex. Bebidas)
 * Idempotente: só afeta produtos com kind ainda unset/default, respeitando o setor
 * da categoria. Rodar uma única vez após `prisma db push`.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const categories = await db.category.findMany({ select: { id: true, name: true, sector: true } })
  let meals = 0
  let products = 0
  for (const cat of categories) {
    const kind = cat.sector === 'BAR' ? 'PRODUCT' : 'MEAL'
    const res = await db.product.updateMany({ where: { categoryId: cat.id }, data: { kind } })
    if (kind === 'MEAL') meals += res.count
    else products += res.count
    console.log(`${cat.name} (${cat.sector}) → ${kind}: ${res.count} itens`)
  }
  console.log(`\nTotal: ${meals} refeições · ${products} produtos`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => void db.$disconnect())

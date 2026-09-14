import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

function randomToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

const PLANS = [
  { key: 'TRIAL', name: 'Teste grátis', price: 0, duration: 14, sortOrder: 0, features: 'Todos os módulos liberados\nAté 10 funcionários\nSuporte por e-mail' },
  { key: 'BASIC', name: 'Básico', price: 99.9, duration: 30, sortOrder: 1, features: 'Comandas, cozinha e caixa\nCardápio digital com QR\nAté 15 funcionários\nSuporte em horário comercial' },
  { key: 'PRO', name: 'Pro', price: 189.9, duration: 30, sortOrder: 2, features: 'Tudo do Básico\nDashboard completo e relatórios\nMesas ilimitadas\nPermissões por cargo\nSuporte prioritário' },
  { key: 'PREMIUM', name: 'Premium', price: 329.9, duration: 30, sortOrder: 3, features: 'Tudo do Pro\nMúltiplas unidades\nGestão de refeições\nSuporte 24/7 com atendimento dedicado' },
]

const CATEGORIES = [
  { name: 'Entradas', sector: 'KITCHEN', icon: '🥗', sortOrder: 1 },
  { name: 'Pratos Principais', sector: 'KITCHEN', icon: '🍛', sortOrder: 2 },
  { name: 'Pizzas', sector: 'PIZZERIA', icon: '🍕', sortOrder: 3 },
  { name: 'Hambúrgueres', sector: 'KITCHEN', icon: '🍔', sortOrder: 4 },
  { name: 'Churrasco', sector: 'GRILL', icon: '🥩', sortOrder: 5 },
  { name: 'Bebidas', sector: 'BAR', icon: '🍹', sortOrder: 6 },
  { name: 'Sobremesas', sector: 'KITCHEN', icon: '🍰', sortOrder: 7 },
]

const PRODUCTS: Array<[string, string, number, number, string, string]> = [
  // nome, categoria, preço, tempoPrep, emoji, descrição
  ['Bruschetta Italiana', 'Entradas', 28.9, 10, '🍞', 'Pão artesanal, tomate confit, manjericão fresco e azeite extra virgem'],
  ['Carpaccio clássico', 'Entradas', 42.5, 8, '🥩', 'Filé bovino fatiado fino, alcaparras, mostarda dijon e parmesão'],
  ['Bolinho de bacalhau (6un)', 'Entradas', 36.0, 12, '🐟', 'Bacalhau desfiado, batata, salsinha e maionese da casa'],
  ['Salmão grelhado', 'Pratos Principais', 68.9, 25, '🐠', 'Salmão norueguês, legumes na manteiga de ervas e arroz de limão siciliano'],
  ['Risoto de funghi', 'Pratos Principais', 58.0, 28, '🍄', 'Arroz arbóreo, mix de cogumelos frescos e parmesão 24 meses'],
  ['Fettuccine ao pesto', 'Pratos Principais', 49.9, 22, '🍝', 'Massa fresca, pesto de manjericão, tomate seco e pinoli'],
  ['Frango à parmegiana', 'Pratos Principais', 52.0, 26, '🍗', 'Filé empanado, molho pomodoro, mussarela e arroz soltinho'],
  ['Pizza Margherita', 'Pizzas', 54.9, 18, '🍕', 'Molho san marzano, fior di latte, manjericão e azeite'],
  ['Pizza Pepperoni', 'Pizzas', 62.0, 18, '🍕', 'Pepperoni artesanal, mussarela especial e orégano'],
  ['Pizza Quatro Queijos', 'Pizzas', 66.5, 20, '🧀', 'Mussarela, gorgonzola, parmesão e catupiry'],
  ['Pizza Calabresa', 'Pizzas', 58.0, 18, '🍕', 'Calabresa fatiada, cebola roxa e azeitonas'],
  ['Apex Burger', 'Hambúrgueres', 44.9, 15, '🍔', 'Blend 180g, cheddar inglês, bacon caramelizado e molho apex'],
  ['Duplo Bacon', 'Hambúrgueres', 52.9, 16, '🍔', 'Dois blends 160g, dobro de bacon, queijo prato e picles'],
  ['Smash Cheddar', 'Hambúrgueres', 38.9, 12, '🍔', 'Smash 120g, cheddar duplo, cebola crispy e maionese defumada'],
  ['Chicken Crispy', 'Hambúrgueres', 36.9, 14, '🍗', 'Frango empanado crocante, alface americana e molho ranch'],
  ['Picanha na brasa', 'Churrasco', 89.9, 30, '🥩', 'Fatias de picanha 400g, farofa, vinagrete e mandioca frita'],
  ['Costela assada', 'Churrasco', 78.0, 35, '🍖', 'Costela bovina 12h de cocção lenta, barbecue artesanal'],
  ['Coração de galinha', 'Churrasco', 42.0, 18, '🍢', 'Espetinho clássico com farofa de alho'],
  ['Contra-filé', 'Churrasco', 72.0, 25, '🥩', 'Corte nobre 350g na brasa com manteiga de ervas'],
  ['Refrigerante lata', 'Bebidas', 8.5, 2, '🥤', 'Coca-Cola, Guaraná ou Fanta 350ml'],
  ['Suco natural', 'Bebidas', 14.0, 6, '🧃', 'Laranja, limão, maracujá ou abacaxi — 500ml'],
  ['Chopp artesanal 500ml', 'Bebidas', 18.0, 4, '🍺', 'IPA ou Lager da casa, tirado na hora'],
  ['Água mineral', 'Bebidas', 5.0, 1, '💧', 'Com ou sem gás, 500ml'],
  ['Caipirinha', 'Bebidas', 22.0, 6, '🍹', 'Cachaça artesanal, limão taiti e açúcar demerara'],
  ['Vinho da casa (taça)', 'Bebidas', 26.0, 3, '🍷', 'Cabernet Sauvignon ou Malbec'],
  ['Pudim de leite', 'Sobremesas', 18.9, 5, '🍮', 'Receita tradicional com calda de caramelo'],
  ['Brownie com sorvete', 'Sobremesas', 24.9, 8, '🍫', 'Brownie quente, sorvete de creme e calda de chocolate'],
  ['Petit gâteau', 'Sobremesas', 27.9, 12, '🎂', 'Bolo quente de chocolate belga com sorvete de baunilha'],
]

const day = 86_400_000

export async function ensureSeed(): Promise<boolean> {
  const userCount = await db.user.count()
  if (userCount > 0) return false

  // ---- Planos da plataforma ----
  for (const p of PLANS) {
    await db.plan.upsert({ where: { key: p.key }, create: p, update: p })
  }

  // ---- Super admin (desenvolvedor da plataforma) ----
  await db.user.upsert({
    where: { email: 'dev@apexfood.com' },
    create: { name: 'Equipe APEX · Dev', email: 'dev@apexfood.com', password: hashPassword('apex123'), role: 'SUPER_ADMIN', status: 'ONLINE' },
    update: {},
  })

  // ---- Estabelecimento principal ----
  const establishment = await db.establishment.create({
    data: {
      name: 'EMPÓRIO RESTAURANTE',
      cnpj: '12.345.678/0001-90',
      logo: '🍴',
      type: 'RESTAURANTE',
      active: true,
      plan: 'PRO',
      billingStatus: 'PAID',
      trialEndsAt: new Date(Date.now() - 60 * day),
      currentPeriodEnd: new Date(Date.now() + 18 * day),
      lastPaymentAt: new Date(Date.now() - 12 * day),
      notes: 'Cliente desde 2024 · renovação automática',
    },
  })
  const estId = establishment.id

  // ---- Usuários do estabelecimento ----
  const pwd = hashPassword('apex123')
  const admin = await db.user.create({ data: { name: 'Ana Costa', email: 'admin@apexfood.com', password: pwd, role: 'ADMIN', status: 'ONLINE', establishmentId: estId } })
  await db.user.create({ data: { name: 'Marcos Lima', email: 'gerente@apexfood.com', password: pwd, role: 'MANAGER', status: 'ONLINE', establishmentId: estId } })
  const w1 = await db.user.create({ data: { name: 'Rafael Souza', email: 'rafael@apexfood.com', password: pwd, role: 'WAITER', status: 'ONLINE', establishmentId: estId } })
  const w2 = await db.user.create({ data: { name: 'Juliana Alves', email: 'juliana@apexfood.com', password: pwd, role: 'WAITER', status: 'ONLINE', establishmentId: estId } })
  const w3 = await db.user.create({ data: { name: 'Carlos Mendes', email: 'carlos@apexfood.com', password: pwd, role: 'WAITER', status: 'ONLINE', establishmentId: estId } })
  await db.user.create({ data: { name: 'Equipe Cozinha', email: 'cozinha@apexfood.com', password: pwd, role: 'KITCHEN', status: 'BUSY', establishmentId: estId } })
  const cashier = await db.user.create({ data: { name: 'Fernanda Rocha', email: 'caixa@apexfood.com', password: pwd, role: 'CASHIER', status: 'ONLINE', establishmentId: estId } })

  // ---- Categorias e produtos ----
  const catMap = new Map<string, string>()
  for (const c of CATEGORIES) {
    const cat = await db.category.create({ data: { ...c, establishmentId: estId } })
    catMap.set(c.name, cat.id)
  }
  const productMap = new Map<string, { id: string; price: number; prepTime: number; station: string; name: string }>()
  for (const [name, cat, price, prep, emoji, desc] of PRODUCTS) {
    const sector = CATEGORIES.find((c) => c.name === cat)?.sector ?? 'KITCHEN'
    const p = await db.product.create({
      data: { name, description: desc, price, prepTime: prep, emoji, categoryId: catMap.get(cat)!, establishmentId: estId },
    })
    productMap.set(name, { id: p.id, price, prepTime: prep, station: sector, name })
  }

  // ---- Mesas ----
  const tables: Array<{ id: string; number: number }> = []
  for (let i = 1; i <= 12; i++) {
    const t = await db.restaurantTable.create({
      data: { number: i, capacity: i <= 8 ? 4 : 6, qrToken: randomToken(), establishmentId: estId },
    })
    tables.push({ id: t.id, number: t.number })
  }

  // ---- Metas ----
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  await db.goal.create({ data: { userId: w1.id, title: 'Comandas atendidas no mês', target: 60, month, establishmentId: estId } })
  await db.goal.create({ data: { userId: w2.id, title: 'Comandas atendidas no mês', target: 50, month, establishmentId: estId } })
  await db.goal.create({ data: { userId: w3.id, title: 'Comandas atendidas no mês', target: 45, month, establishmentId: estId } })

  // ---- Configurações ----
  const settings: Array<[string, string]> = [
    ['establishmentName', 'EMPÓRIO RESTAURANTE'],
    ['establishmentType', 'RESTAURANTE'],
    ['establishmentLogo', '🍴'],
    ['distributionRule', 'least_active'],
    ['confirmTimeout', '5'],
    ['alertThreshold', '20'],
    ['soundEnabled', 'true'],
    ['acceptCredit', 'true'],
    ['acceptDebit', 'true'],
    ['acceptPix', 'true'],
    ['acceptCash', 'true'],
    ['defaultGoal', '50'],
  ]
  for (const [key, value] of settings) {
    await db.setting.create({ data: { key, value, establishmentId: estId } })
  }

  // ---- Histórico de comandas pagas (7 dias) para métricas ----
  const waiters = [w1, w2, w3]
  const methods = ['CREDIT', 'DEBIT', 'PIX', 'CASH']
  const productNames = PRODUCTS.map((p) => p[0])
  let codeSeq = 1

  for (let d = 7; d >= 1; d--) {
    const ordersToday = 6 + Math.floor(Math.random() * 6)
    for (let k = 0; k < ordersToday; k++) {
      const created = new Date()
      created.setDate(created.getDate() - d)
      created.setHours(11 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0)
      const waiter = waiters[Math.floor(Math.random() * waiters.length)]
      const table = tables[Math.floor(Math.random() * tables.length)]
      const itemCount = 1 + Math.floor(Math.random() * 3)
      const picked = new Set<string>()
      let total = 0
      const itemsData: Array<{ productId: string; productName: string; quantity: number; notes: string; unitPrice: number; station: string; prepTime: number }> = []
      for (let i = 0; i < itemCount; i++) {
        let pn = productNames[Math.floor(Math.random() * productNames.length)]
        if (picked.has(pn)) continue
        picked.add(pn)
        const prod = productMap.get(pn)!
        const qty = 1 + Math.floor(Math.random() * 2)
        total += prod.price * qty
        itemsData.push({ productId: prod.id, productName: prod.name, quantity: qty, notes: '', unitPrice: prod.price, station: prod.station, prepTime: prod.prepTime })
      }
      if (itemsData.length === 0) continue
      const confirmed = new Date(created.getTime() + (2 + Math.floor(Math.random() * 6)) * 60000)
      const paid = new Date(confirmed.getTime() + (35 + Math.floor(Math.random() * 40)) * 60000)
      const order = await db.order.create({
        data: {
          code: `C${String(codeSeq++).padStart(4, '0')}`,
          tableId: table.id,
          waiterId: waiter.id,
          status: 'PAID',
          total: Math.round(total * 100) / 100,
          createdAt: created,
          confirmedAt: confirmed,
          finishedAt: paid,
          paidAt: paid,
          establishmentId: estId,
        },
      })
      for (const it of itemsData) {
        await db.orderItem.create({ data: { ...it, orderId: order.id, status: 'SERVED', startedAt: confirmed, readyAt: new Date(confirmed.getTime() + it.prepTime * 60000), servedAt: paid } })
      }
      await db.payment.create({ data: { orderId: order.id, method: methods[Math.floor(Math.random() * methods.length)], amount: order.total, cashierId: cashier.id, createdAt: paid } })
    }
  }

  // ---- Comandas ativas para demonstração imediata ----
  const activeSeed: Array<{ tableIdx: number; waiter: any; items: string[]; status: string }> = [
    { tableIdx: 0, waiter: w1, items: ['Pizza Margherita', 'Refrigerante lata'], status: 'PENDING_CONFIRM' },
    { tableIdx: 2, waiter: w2, items: ['Apex Burger', 'Chopp artesanal 500ml', 'Batata rústica'], status: 'IN_KITCHEN' },
    { tableIdx: 5, waiter: w1, items: ['Picanha na brasa', 'Suco natural'], status: 'IN_KITCHEN' },
  ]
  for (const [i, s] of activeSeed.entries()) {
    let total = 0
    const items: any[] = []
    for (const pn of s.items) {
      const prod = productMap.get(pn)
      if (!prod) continue
      total += prod.price
      items.push({ productId: prod.id, productName: prod.name, quantity: 1, notes: '', unitPrice: prod.price, station: prod.station, prepTime: prod.prepTime, status: s.status === 'IN_KITCHEN' && i === 1 ? 'READY' : 'PENDING' })
    }
    const created = new Date(Date.now() - (10 + i * 7) * 60000)
    const order = await db.order.create({
      data: {
        code: `C${String(codeSeq++).padStart(4, '0')}`,
        tableId: tables[s.tableIdx].id,
        waiterId: s.waiter.id,
        status: s.status,
        total: Math.round(total * 100) / 100,
        createdAt: created,
        confirmedAt: s.status === 'IN_KITCHEN' ? new Date(created.getTime() + 4 * 60000) : null,
        establishmentId: estId,
      },
    })
    for (const it of items) {
      await db.orderItem.create({ data: { ...it, orderId: order.id } })
    }
    await db.restaurantTable.update({ where: { id: tables[s.tableIdx].id }, data: { status: 'OCCUPIED' } })
  }

  void admin
  return true
}

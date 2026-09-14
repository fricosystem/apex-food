/**
 * Migração multi-tenant do APEX FOOD.
 * - Cria o estabelecimento principal (dados já existentes) e vincula todas as linhas órfãs.
 * - Cria os planos comerciais (TRIAL/BASIC/PRO/PREMIUM).
 * - Cria a conta do desenvolvedor (SUPER_ADMIN, sem estabelecimento).
 * - Cria estabelecimentos de demonstração com planos/status variados.
 * Idempotente: se já existir Establishment, apenas garante planos + super admin.
 */
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

const PLANS = [
  { key: 'TRIAL', name: 'Teste grátis', price: 0, duration: 14, sortOrder: 0, features: 'Todos os módulos liberados\nAté 10 funcionários\nSuporte por e-mail' },
  { key: 'BASIC', name: 'Básico', price: 99.9, duration: 30, sortOrder: 1, features: 'Comandas, cozinha e caixa\nCardápio digital com QR\nAté 15 funcionários\nSuporte em horário comercial' },
  { key: 'PRO', name: 'Pro', price: 189.9, duration: 30, sortOrder: 2, features: 'Tudo do Básico\nDashboard completo e relatórios\nMesas ilimitadas\nPermissões por cargo\nSuporte prioritário' },
  { key: 'PREMIUM', name: 'Premium', price: 329.9, duration: 30, sortOrder: 3, features: 'Tudo do Pro\nMúltiplas unidades\nGestão de refeições\nSuporte 24/7 com atendimento dedicado' },
]

const day = 86_400_000
const daysFromNow = (d: number) => new Date(Date.now() + d * day)

async function main() {
  // ---- Planos ----
  for (const p of PLANS) {
    await db.plan.upsert({ where: { key: p.key }, create: p, update: p })
  }
  console.log('planos ok')

  // ---- Super admin (desenvolvedor) ----
  const devEmail = 'dev@apexfood.com'
  const existingDev = await db.user.findUnique({ where: { email: devEmail } })
  if (!existingDev) {
    await db.user.create({
      data: { name: 'Equipe APEX · Dev', email: devEmail, password: hashPassword('apex123'), role: 'SUPER_ADMIN', status: 'ONLINE' },
    })
    console.log('super admin criado')
  } else if (existingDev.role !== 'SUPER_ADMIN') {
    await db.user.update({ where: { id: existingDev.id }, data: { role: 'SUPER_ADMIN' } })
  }

  // ---- Estabelecimento principal + vínculo dos dados existentes ----
  let main = await db.establishment.findFirst({ where: { cnpj: '12.345.678/0001-90' } })
  if (!main) {
    main = await db.establishment.create({
      data: {
        name: 'EMPÓRIO RESTAURANTE',
        cnpj: '12.345.678/0001-90',
        logo: '🍴',
        type: 'RESTAURANTE',
        active: true,
        plan: 'PRO',
        billingStatus: 'PAID',
        trialEndsAt: daysFromNow(-60),
        currentPeriodEnd: daysFromNow(18),
        lastPaymentAt: daysFromNow(-12),
        notes: 'Cliente desde 2024 · renovação automática',
      },
    })
    console.log('estabelecimento principal criado:', main.id)
  }
  const estId = main.id

  // Vincula linhas órfãs (migração dos dados legados)
  const r = await db.$transaction([
    db.user.updateMany({ where: { establishmentId: null, role: { not: 'SUPER_ADMIN' } }, data: { establishmentId: estId } }),
    db.restaurantTable.updateMany({ where: { establishmentId: null }, data: { establishmentId: estId } }),
    db.category.updateMany({ where: { establishmentId: null }, data: { establishmentId: estId } }),
    db.product.updateMany({ where: { establishmentId: null }, data: { establishmentId: estId } }),
    db.order.updateMany({ where: { establishmentId: null }, data: { establishmentId: estId } }),
    db.goal.updateMany({ where: { establishmentId: null }, data: { establishmentId: estId } }),
    db.setting.updateMany({ where: { establishmentId: null }, data: { establishmentId: estId } }),
  ])
  console.log('vínculos:', r.map((x) => x.count).join(' · '))

  // ---- Estabelecimentos de demonstração ----
  const demoPwd = hashPassword('apex123')

  const demos: Array<{
    name: string; cnpj: string; logo: string; type: string
    plan: string; billingStatus: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; lastPaymentAt: Date | null
    notes: string; users: Array<{ name: string; email: string; role: string }>
  }> = [
    {
      name: 'Pizzaria Bella Massa', cnpj: '23.987.114/0001-22', logo: '🍕', type: 'PIZZARIA',
      plan: 'BASIC', billingStatus: 'TRIAL', trialEndsAt: daysFromNow(9), currentPeriodEnd: null, lastPaymentAt: null,
      notes: 'Cadastro via site · teste iniciado',
      users: [
        { name: 'Marco Aurélio', email: 'marco@bellamassa.com', role: 'MANAGER' },
        { name: 'Bella Cozinha', email: 'cozinha@bellamassa.com', role: 'KITCHEN' },
      ],
    },
    {
      name: 'Burger House Downtown', cnpj: '31.554.902/0001-07', logo: '🍔', type: 'RESTAURANTE',
      plan: 'BASIC', billingStatus: 'OVERDUE', trialEndsAt: daysFromNow(-40), currentPeriodEnd: daysFromNow(-5), lastPaymentAt: daysFromNow(-35),
      notes: 'Inadimplente há 5 dias · cobrança enviada',
      users: [{ name: 'Patrícia Nunes', email: 'patricia@burgerhouse.com', role: 'ADMIN' }],
    },
    {
      name: 'Cantina do Vale', cnpj: '45.221.330/0001-51', logo: '🍝', type: 'RESTAURANTE',
      plan: 'TRIAL', billingStatus: 'TRIAL', trialEndsAt: daysFromNow(-3), currentPeriodEnd: null, lastPaymentAt: null,
      notes: 'Teste expirado · aguardando conversão',
      users: [{ name: 'Severino Dias', email: 'severino@cantinadovale.com', role: 'ADMIN' }],
    },
  ]

  for (const d of demos) {
    const exists = await db.establishment.findFirst({ where: { cnpj: d.cnpj } })
    if (exists) continue
    const est = await db.establishment.create({
      data: {
        name: d.name, cnpj: d.cnpj, logo: d.logo, type: d.type,
        plan: d.plan, billingStatus: d.billingStatus,
        trialEndsAt: d.trialEndsAt, currentPeriodEnd: d.currentPeriodEnd, lastPaymentAt: d.lastPaymentAt,
        notes: d.notes,
      },
    })
    for (const u of d.users) {
      await db.user.upsert({
        where: { email: u.email },
        create: { name: u.name, email: u.email, password: demoPwd, role: u.role, status: 'ONLINE', establishmentId: est.id },
        update: {},
      })
    }
    // Configurações básicas por estabelecimento
    for (const [key, value] of [
      ['distributionRule', 'least_active'], ['confirmTimeout', '5'], ['alertThreshold', '20'],
      ['soundEnabled', 'true'], ['acceptCredit', 'true'], ['acceptDebit', 'true'],
      ['acceptPix', 'true'], ['acceptCash', 'true'], ['defaultGoal', '50'],
    ] as const) {
      await db.setting.upsert({
        where: { establishmentId_key: { establishmentId: est.id, key } },
        create: { establishmentId: est.id, key, value },
        update: {},
      })
    }
    console.log('demo criado:', d.name)
  }

  const total = await db.establishment.count()
  console.log(`concluído — ${total} estabelecimentos na plataforma`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())

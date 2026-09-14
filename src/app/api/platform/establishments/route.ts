import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

/** GET /api/platform/establishments — lista todos os tenants com contadores (SUPER_ADMIN) */
export async function GET() {
  const auth = await requireUser(['SUPER_ADMIN'])
  if (isResponse(auth)) return auth

  const establishments = await db.establishment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, orders: true, products: true, tables: true } },
    },
  })

  const plans = await db.plan.findMany({ orderBy: { sortOrder: 'asc' } })
  const priceByKey = new Map(plans.map((p) => [p.key, p.price]))
  // Assinantes por plano (contagem de tenants em cada plano)
  const grouped = await db.establishment.groupBy({ by: ['plan'], _count: { _all: true } })
  const subsByKey = new Map(grouped.map((g) => [g.plan, g._count._all]))
  const plansWithSubs = plans.map((p) => ({ ...p, subscribers: subsByKey.get(p.key) ?? 0 }))

  const rows = establishments.map((e) => ({
    id: e.id,
    name: e.name,
    cnpj: e.cnpj,
    logo: e.logo,
    type: e.type,
    phone: e.phone,
    address: e.address,
    active: e.active,
    plan: e.plan,
    billingStatus: e.billingStatus,
    trialEndsAt: e.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: e.currentPeriodEnd?.toISOString() ?? null,
    lastPaymentAt: e.lastPaymentAt?.toISOString() ?? null,
    notes: e.notes,
    permissions: e.permissions,
    createdAt: e.createdAt.toISOString(),
    monthlyPrice: priceByKey.get(e.plan) ?? 0,
    counts: {
      users: e._count.users,
      orders: e._count.orders,
      products: e._count.products,
      tables: e._count.tables,
    },
  }))

  // KPIs da plataforma
  const now = Date.now()
  const paid = rows.filter((r) => r.billingStatus === 'PAID' && r.active)
  const trialing = rows.filter((r) => r.billingStatus === 'TRIAL' && r.active)
  const overdue = rows.filter(
    (r) => r.active && (r.billingStatus === 'OVERDUE' || (r.currentPeriodEnd && new Date(r.currentPeriodEnd).getTime() < now) || (r.trialEndsAt && r.billingStatus === 'TRIAL' && new Date(r.trialEndsAt).getTime() < now))
  )
  const mrr = paid.reduce((sum, r) => sum + r.monthlyPrice, 0)

  return NextResponse.json({
    establishments: rows,
    kpis: {
      total: rows.length,
      active: rows.filter((r) => r.active).length,
      paid: paid.length,
      trialing: trialing.length,
      overdue: overdue.length,
      suspended: rows.filter((r) => !r.active).length,
      mrr,
    },
    plans: plansWithSubs,
  })
}

type CreateBody = {
  name?: string; cnpj?: string; logo?: string; type?: string; phone?: string
  plan?: string; billingStatus?: string; trialDays?: number
}

/** POST /api/platform/establishments — cria estabelecimento manualmente (SUPER_ADMIN) */
export async function POST(req: NextRequest) {
  const auth = await requireUser(['SUPER_ADMIN'])
  if (isResponse(auth)) return auth
  const body = await readJson<CreateBody>(req)
  const name = body?.name?.trim()
  if (!name) return bad('Informe o nome do estabelecimento')

  const planKey = body?.plan && ['TRIAL', 'BASIC', 'PRO', 'PREMIUM'].includes(body.plan) ? body.plan : 'TRIAL'
  const trialDays = Math.max(1, Math.min(90, Math.round(body?.trialDays ?? 14)))
  const billingStatus = body?.billingStatus && ['TRIAL', 'PAID', 'OVERDUE', 'CANCELED'].includes(body.billingStatus)
    ? body.billingStatus
    : (planKey === 'TRIAL' ? 'TRIAL' : 'PAID')

  const est = await db.establishment.create({
    data: {
      name: name.slice(0, 80),
      cnpj: body?.cnpj?.trim() ?? '',
      logo: body?.logo?.trim() || '🍴',
      type: body?.type?.trim() || 'RESTAURANTE',
      phone: body?.phone?.trim() ?? '',
      plan: planKey,
      billingStatus,
      trialEndsAt: billingStatus === 'TRIAL' ? new Date(Date.now() + trialDays * 86_400_000) : null,
      currentPeriodEnd: billingStatus === 'PAID' ? new Date(Date.now() + 30 * 86_400_000) : null,
      notes: 'Criado pelo painel da plataforma',
    },
  })

  for (const [key, value] of [
    ['distributionRule', 'least_active'], ['confirmTimeout', '5'], ['alertThreshold', '20'],
    ['soundEnabled', 'true'], ['acceptCredit', 'true'], ['acceptDebit', 'true'],
    ['acceptPix', 'true'], ['acceptCash', 'true'], ['defaultGoal', '50'],
  ] as const) {
    await db.setting.create({ data: { establishmentId: est.id, key, value } })
  }

  broadcast('dados:alterados', { type: 'platform' })
  return NextResponse.json({ establishment: est })
}

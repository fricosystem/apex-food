import { NextRequest, NextResponse } from 'next/server'
import { establishmentsCol, plansCol, usersCol, ordersCol, productsCol, tablesCol, countDocs, tsToIso } from '@/lib/fs'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'
import { PLATFORM_ROLES } from '@/lib/permissions'

/** GET /api/platform/establishments — lista todos os tenants com contadores (cargos de gestão da plataforma) */
export async function GET() {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth

  const [estsSnap, plansSnap] = await Promise.all([
    establishmentsCol().orderBy('createdAt', 'desc').get(),
    plansCol().orderBy('sortOrder', 'asc').get(),
  ])
  const plans = plansSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as { id: string; price: number } & Record<string, unknown>)
  const priceByKey = new Map(plans.map((p) => [p.id, p.price]))

  const rows = await Promise.all(
    estsSnap.docs.map(async (d) => {
      const e = d.data() as Record<string, unknown> & {
        name: string; cnpj: string; logo: string; type: string; phone: string; address: string
        active: boolean; plan: string; billingStatus: string; notes: string; permissions: string; createdAt: unknown
        trialEndsAt: unknown; currentPeriodEnd: unknown; periodStartAt: unknown; lastPaymentAt: unknown
      }
      const [users, orders, products, tables] = await Promise.all([
        countDocs(usersCol().where('establishmentId', '==', d.id)),
        countDocs(ordersCol(d.id)),
        countDocs(productsCol(d.id)),
        countDocs(tablesCol(d.id)),
      ])
      return {
        id: d.id, name: e.name, cnpj: e.cnpj, logo: e.logo, type: e.type, phone: e.phone, address: e.address,
        active: e.active, plan: e.plan, billingStatus: e.billingStatus,
        trialEndsAt: tsToIso(e.trialEndsAt), currentPeriodEnd: tsToIso(e.currentPeriodEnd),
        periodStartAt: tsToIso(e.periodStartAt), lastPaymentAt: tsToIso(e.lastPaymentAt),
        notes: e.notes, permissions: e.permissions, createdAt: tsToIso(e.createdAt),
        monthlyPrice: priceByKey.get(e.plan) ?? 0,
        counts: { users, orders, products, tables },
      }
    }),
  )

  // Assinantes por plano (contagem de tenants em cada plano)
  const subsByKey = new Map<string, number>()
  for (const r of rows) subsByKey.set(r.plan, (subsByKey.get(r.plan) ?? 0) + 1)
  const plansWithSubs = plans.map((p) => ({ ...p, subscribers: subsByKey.get(p.id) ?? 0 }))

  // KPIs da plataforma
  const now = Date.now()
  const paid = rows.filter((r) => r.billingStatus === 'PAID' && r.active)
  const trialing = rows.filter((r) => r.billingStatus === 'TRIAL' && r.active)
  const overdue = rows.filter(
    (r) => r.active && (r.billingStatus === 'OVERDUE' || (r.currentPeriodEnd && new Date(r.currentPeriodEnd).getTime() < now) || (r.trialEndsAt && r.billingStatus === 'TRIAL' && new Date(r.trialEndsAt).getTime() < now)),
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

const DEFAULT_SETTINGS = {
  distributionRule: 'least_active', confirmTimeout: '5', alertThreshold: '20', soundEnabled: 'true',
  acceptCredit: 'true', acceptDebit: 'true', acceptPix: 'true', acceptCash: 'true', defaultGoal: '50',
}

/** POST /api/platform/establishments — cria estabelecimento manualmente (cargos de gestão da plataforma) */
export async function POST(req: NextRequest) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const body = await readJson<CreateBody>(req)
  const name = body?.name?.trim()
  if (!name) return bad('Informe o nome do estabelecimento')

  const planKey = body?.plan && ['TRIAL', 'BASIC', 'PRO', 'PREMIUM'].includes(body.plan) ? body.plan : 'TRIAL'
  const trialDays = Math.max(1, Math.min(90, Math.round(body?.trialDays ?? 14)))
  const billingStatus = body?.billingStatus && ['TRIAL', 'PAID', 'OVERDUE', 'CANCELED'].includes(body.billingStatus)
    ? body.billingStatus
    : (planKey === 'TRIAL' ? 'TRIAL' : 'PAID')

  const now = new Date()
  const data = {
    name: name.slice(0, 80),
    cnpj: body?.cnpj?.trim() ?? '',
    logo: body?.logo?.trim() || '🍴',
    type: body?.type?.trim() || 'RESTAURANTE',
    phone: body?.phone?.trim() ?? '',
    address: '',
    active: true,
    plan: planKey,
    billingStatus,
    periodStartAt: now,
    trialEndsAt: billingStatus === 'TRIAL' ? new Date(Date.now() + trialDays * 86_400_000) : null,
    currentPeriodEnd: billingStatus === 'PAID' ? new Date(Date.now() + 30 * 86_400_000) : null,
    lastPaymentAt: null,
    notes: 'Criado pelo painel da plataforma',
    permissions: '{}',
    settings: DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  }
  const ref = await establishmentsCol().add(data)

  broadcast('dados:alterados', { type: 'platform' })
  return NextResponse.json({ establishment: { id: ref.id, ...data } })
}

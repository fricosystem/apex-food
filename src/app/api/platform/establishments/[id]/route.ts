import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'
import { DEFAULT_VIEW_ROLES, TENANT_ROLES, PLATFORM_ROLES } from '@/lib/permissions'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/platform/establishments/[id] — detalhe do tenant (cargos de gestão da plataforma) */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const { id } = await params
  const est = await db.establishment.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, active: true, status: true }, orderBy: { createdAt: 'asc' } },
      _count: { select: { orders: true, products: true, tables: true, users: true } },
    },
  })
  if (!est) return bad('Estabelecimento não encontrado', 404)
  return NextResponse.json({
    establishment: {
      ...est,
      createdAt: est.createdAt.toISOString(),
      trialEndsAt: est.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: est.currentPeriodEnd?.toISOString() ?? null,
      periodStartAt: est.periodStartAt?.toISOString() ?? null,
      lastPaymentAt: est.lastPaymentAt?.toISOString() ?? null,
    },
  })
}

type PatchBody = {
  name?: string; cnpj?: string; logo?: string; type?: string; phone?: string; address?: string
  active?: boolean; plan?: string; billingStatus?: string
  trialEndsAt?: string | null; currentPeriodEnd?: string | null; periodStartAt?: string | null; lastPaymentAt?: string | null
  notes?: string; permissions?: Record<string, string[]>
  markPaidNow?: boolean; extendDays?: number
}

function parseDate(v: string | null | undefined): Date | null {
  if (v === null) return null
  if (!v) return undefined as unknown as null
  // Formatos aceitos: YYYY-MM-DD (input date) ou ISO completo
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v)
  return Number.isNaN(d.getTime()) ? (undefined as unknown as null) : d
}

/** PATCH /api/platform/establishments/[id] — atualiza dados, plano/cobrança e permissões (cargos de gestão da plataforma) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const { id } = await params
  const est = await db.establishment.findUnique({ where: { id } })
  if (!est) return bad('Estabelecimento não encontrado', 404)

  const body = await readJson<PatchBody>(req)
  if (!body) return bad('Payload inválido')

  const data: Record<string, unknown> = {}

  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 80)
  if (typeof body.cnpj === 'string') data.cnpj = body.cnpj.trim().slice(0, 24)
  if (typeof body.logo === 'string' && body.logo.trim()) data.logo = body.logo.trim().slice(0, 8)
  if (typeof body.type === 'string' && body.type.trim()) data.type = body.type.trim()
  if (typeof body.phone === 'string') data.phone = body.phone.trim().slice(0, 32)
  if (typeof body.address === 'string') data.address = body.address.trim().slice(0, 160)
  if (typeof body.active === 'boolean') data.active = body.active
  if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 500)

  if (typeof body.plan === 'string' && ['TRIAL', 'BASIC', 'PRO', 'PREMIUM'].includes(body.plan)) {
    data.plan = body.plan
  }
  if (typeof body.billingStatus === 'string' && ['TRIAL', 'PAID', 'OVERDUE', 'CANCELED'].includes(body.billingStatus)) {
    data.billingStatus = body.billingStatus
  }

  // Atalho: registra pagamento agora → status PAID + novo período iniciando hoje
  if (body.markPaidNow) {
    const plan = typeof data.plan === 'string' ? data.plan : est.plan
    const planRow = await db.plan.findUnique({ where: { key: plan } })
    const days = planRow?.duration ?? 30
    data.billingStatus = 'PAID'
    data.lastPaymentAt = new Date()
    data.periodStartAt = new Date()
    data.currentPeriodEnd = new Date(Date.now() + days * 86_400_000)
  }

  // Atalho: estende o vencimento em N dias
  if (typeof body.extendDays === 'number' && body.extendDays !== 0) {
    const base = body.extendDays > 0
      ? (est.currentPeriodEnd && est.currentPeriodEnd > new Date() ? est.currentPeriodEnd : new Date())
      : new Date()
    data.currentPeriodEnd = new Date(base.getTime() + body.extendDays * 86_400_000)
  }

  const trial = parseDate(body.trialEndsAt)
  if (trial !== undefined && 'trialEndsAt' in body) data.trialEndsAt = trial
  const period = parseDate(body.currentPeriodEnd)
  if (period !== undefined && 'currentPeriodEnd' in body) data.currentPeriodEnd = period
  const startAt = parseDate(body.periodStartAt)
  if (startAt !== undefined && 'periodStartAt' in body) data.periodStartAt = startAt
  const lastPay = parseDate(body.lastPaymentAt)
  if (lastPay !== undefined && 'lastPaymentAt' in body) data.lastPaymentAt = lastPay

  // Vencimento automático: sem data explícita de fim no pedido, o vencimento do período pago
  // é recalculado a partir da data de início (periodStartAt) + duração do plano selecionado.
  // TRIAL usa o campo Teste até; OVERDUE/CANCELED mantêm o vencimento vigente (já vencido).
  const explicitPeriod = 'currentPeriodEnd' in body || body.markPaidNow || typeof body.extendDays === 'number'
  if (!explicitPeriod) {
    const nextStatus = typeof data.billingStatus === 'string' ? data.billingStatus : est.billingStatus
    const nextPlanKey = typeof data.plan === 'string' ? data.plan : est.plan
    const periodTouched = 'periodStartAt' in data || 'plan' in data || 'billingStatus' in data
    if (nextStatus === 'PAID' && periodTouched) {
      const startSrc = ('periodStartAt' in data ? (data.periodStartAt as Date | null) : est.periodStartAt)
        ?? est.lastPaymentAt ?? est.createdAt
      const planRow = await db.plan.findUnique({ where: { key: nextPlanKey } })
      const days = planRow?.duration ?? 30
      data.currentPeriodEnd = new Date(startSrc.getTime() + days * 86_400_000)
    }
  }

  // Permissões: valida cada tela contra as telas conhecidas e cada cargo contra os cargos de tenant
  if (body.permissions && typeof body.permissions === 'object') {
    const clean: Record<string, string[]> = {}
    for (const [key, roles] of Object.entries(body.permissions)) {
      if (!(key in DEFAULT_VIEW_ROLES)) continue
      if (!Array.isArray(roles)) continue
      const valid = roles.filter((r): r is (typeof TENANT_ROLES)[number] =>
        (TENANT_ROLES as readonly string[]).includes(r)
      )
      clean[key] = [...new Set(valid)]
    }
    data.permissions = JSON.stringify(clean)
  }

  const updated = await db.establishment.update({ where: { id }, data })
  broadcast('dados:alterados', { type: 'platform' })
  broadcast('dados:alterados', { type: 'settings', establishmentId: id })
  return NextResponse.json({
    establishment: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
      periodStartAt: updated.periodStartAt?.toISOString() ?? null,
      lastPaymentAt: updated.lastPaymentAt?.toISOString() ?? null,
    },
  })
}

/** DELETE /api/platform/establishments/[id] — remove o tenant e todos os seus dados (cargos de gestão da plataforma) */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const { id } = await params
  const est = await db.establishment.findUnique({ where: { id } })
  if (!est) return bad('Estabelecimento não encontrado', 404)

  await db.$transaction([
    db.payment.deleteMany({ where: { order: { establishmentId: id } } }),
    db.orderItem.deleteMany({ where: { order: { establishmentId: id } } }),
    db.order.deleteMany({ where: { establishmentId: id } }),
    db.goal.deleteMany({ where: { establishmentId: id } }),
    db.product.deleteMany({ where: { establishmentId: id } }),
    db.category.deleteMany({ where: { establishmentId: id } }),
    db.restaurantTable.deleteMany({ where: { establishmentId: id } }),
    db.setting.deleteMany({ where: { establishmentId: id } }),
    db.user.deleteMany({ where: { establishmentId: id } }),
    db.establishment.delete({ where: { id } }),
  ])

  broadcast('dados:alterados', { type: 'platform' })
  return NextResponse.json({ ok: true })
}

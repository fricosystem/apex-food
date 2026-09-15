import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { establishmentsCol, plansCol, usersCol, ordersCol, productsCol, categoriesCol, tablesCol, goalsCol, qrLookupCol, tsToIso } from '@/lib/fs'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'
import { DEFAULT_VIEW_ROLES, TENANT_ROLES, PLATFORM_ROLES } from '@/lib/permissions'

type Ctx = { params: Promise<{ id: string }> }
type EstDoc = Record<string, unknown> & {
  name: string; cnpj: string; logo: string; type: string; phone: string; address: string
  active: boolean; plan: string; billingStatus: string; notes: string; permissions: string
  createdAt: unknown; trialEndsAt: unknown; currentPeriodEnd: unknown; periodStartAt: unknown; lastPaymentAt: unknown
}

function serializeEst(id: string, e: EstDoc) {
  return {
    ...e, id,
    createdAt: tsToIso(e.createdAt),
    trialEndsAt: tsToIso(e.trialEndsAt),
    currentPeriodEnd: tsToIso(e.currentPeriodEnd),
    periodStartAt: tsToIso(e.periodStartAt),
    lastPaymentAt: tsToIso(e.lastPaymentAt),
  }
}

/** GET /api/platform/establishments/[id] — detalhe do tenant (cargos de gestão da plataforma) */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const { id } = await params
  const snap = await establishmentsCol().doc(id).get()
  if (!snap.exists) return bad('Estabelecimento não encontrado', 404)

  const [usersSnap, ordersCount, productsCount, tablesCount] = await Promise.all([
    usersCol().where('establishmentId', '==', id).get(),
    ordersCol(id).count().get(),
    productsCol(id).count().get(),
    tablesCol(id).count().get(),
  ])
  const users = usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as { id: string; name: string; email: string; role: string; active: boolean; status: string; createdAt: unknown })
    .sort((a, b) => ((a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0) - ((b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0))
    .map(({ createdAt, ...u }) => u)

  return NextResponse.json({
    establishment: {
      ...serializeEst(id, snap.data() as EstDoc),
      users,
      _count: { orders: ordersCount.data().count, products: productsCount.data().count, tables: tablesCount.data().count, users: users.length },
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

function parseDate(v: string | null | undefined): Date | null | undefined {
  if (v === null) return null
  if (!v) return undefined
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** PATCH /api/platform/establishments/[id] — atualiza dados, plano/cobrança e permissões (cargos de gestão da plataforma) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const { id } = await params
  const ref = establishmentsCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Estabelecimento não encontrado', 404)
  const est = snap.data() as EstDoc & { currentPeriodEnd: unknown; periodStartAt: unknown; lastPaymentAt: unknown; createdAt: unknown }

  const body = await readJson<PatchBody>(req)
  if (!body) return bad('Payload inválido')

  const toDate = (v: unknown): Date | null => (v as { toDate?: () => Date } | null)?.toDate?.() ?? null

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 80)
  if (typeof body.cnpj === 'string') data.cnpj = body.cnpj.trim().slice(0, 24)
  if (typeof body.logo === 'string' && body.logo.trim()) data.logo = body.logo.trim().slice(0, 8)
  if (typeof body.type === 'string' && body.type.trim()) data.type = body.type.trim()
  if (typeof body.phone === 'string') data.phone = body.phone.trim().slice(0, 32)
  if (typeof body.address === 'string') data.address = body.address.trim().slice(0, 160)
  if (typeof body.active === 'boolean') data.active = body.active
  if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 500)

  if (typeof body.plan === 'string' && ['TRIAL', 'BASIC', 'PRO', 'PREMIUM'].includes(body.plan)) data.plan = body.plan
  if (typeof body.billingStatus === 'string' && ['TRIAL', 'PAID', 'OVERDUE', 'CANCELED'].includes(body.billingStatus)) data.billingStatus = body.billingStatus

  // Atalho: registra pagamento agora → status PAID + novo período iniciando hoje
  if (body.markPaidNow) {
    const plan = typeof data.plan === 'string' ? data.plan : est.plan
    const planSnap = await plansCol().doc(plan).get()
    const days = (planSnap.data() as { duration?: number })?.duration ?? 30
    data.billingStatus = 'PAID'
    data.lastPaymentAt = new Date()
    data.periodStartAt = new Date()
    data.currentPeriodEnd = new Date(Date.now() + days * 86_400_000)
  }

  // Atalho: estende o vencimento em N dias
  if (typeof body.extendDays === 'number' && body.extendDays !== 0) {
    const curEnd = toDate(est.currentPeriodEnd)
    const base = body.extendDays > 0 ? (curEnd && curEnd > new Date() ? curEnd : new Date()) : new Date()
    data.currentPeriodEnd = new Date(base.getTime() + body.extendDays * 86_400_000)
  }

  if ('trialEndsAt' in body) { const v = parseDate(body.trialEndsAt); if (v !== undefined) data.trialEndsAt = v }
  if ('currentPeriodEnd' in body) { const v = parseDate(body.currentPeriodEnd); if (v !== undefined) data.currentPeriodEnd = v }
  if ('periodStartAt' in body) { const v = parseDate(body.periodStartAt); if (v !== undefined) data.periodStartAt = v }
  if ('lastPaymentAt' in body) { const v = parseDate(body.lastPaymentAt); if (v !== undefined) data.lastPaymentAt = v }

  // Vencimento automático: sem data explícita de fim no pedido, o vencimento do período pago
  // é recalculado a partir da data de início (periodStartAt) + duração do plano selecionado.
  const explicitPeriod = 'currentPeriodEnd' in body || body.markPaidNow || typeof body.extendDays === 'number'
  if (!explicitPeriod) {
    const nextStatus = typeof data.billingStatus === 'string' ? data.billingStatus : est.billingStatus
    const nextPlanKey = typeof data.plan === 'string' ? data.plan : est.plan
    const periodTouched = 'periodStartAt' in data || 'plan' in data || 'billingStatus' in data
    if (nextStatus === 'PAID' && periodTouched) {
      const startSrc = ('periodStartAt' in data ? (data.periodStartAt as Date | null) : toDate(est.periodStartAt))
        ?? toDate(est.lastPaymentAt) ?? toDate(est.createdAt) ?? new Date()
      const planSnap = await plansCol().doc(nextPlanKey).get()
      const days = (planSnap.data() as { duration?: number })?.duration ?? 30
      data.currentPeriodEnd = new Date(startSrc.getTime() + days * 86_400_000)
    }
  }

  // Permissões: valida cada tela contra as telas conhecidas e cada cargo contra os cargos de tenant
  if (body.permissions && typeof body.permissions === 'object') {
    const clean: Record<string, string[]> = {}
    for (const [key, roles] of Object.entries(body.permissions)) {
      if (!(key in DEFAULT_VIEW_ROLES)) continue
      if (!Array.isArray(roles)) continue
      const valid = roles.filter((r): r is (typeof TENANT_ROLES)[number] => (TENANT_ROLES as readonly string[]).includes(r))
      clean[key] = [...new Set(valid)]
    }
    data.permissions = JSON.stringify(clean)
  }

  await ref.update(data)
  const updatedSnap = await ref.get()
  broadcast('dados:alterados', { type: 'platform' })
  broadcast('dados:alterados', { type: 'settings', establishmentId: id })
  return NextResponse.json({ establishment: serializeEst(id, updatedSnap.data() as EstDoc) })
}

/** DELETE /api/platform/establishments/[id] — remove o tenant e todos os seus dados (cargos de gestão da plataforma) */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const { id } = await params
  const ref = establishmentsCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Estabelecimento não encontrado', 404)

  const [usersSnap, ordersSnap, productsSnap, categoriesSnap, tablesSnap, goalsSnap] = await Promise.all([
    usersCol().where('establishmentId', '==', id).get(),
    ordersCol(id).get(),
    productsCol(id).get(),
    categoriesCol(id).get(),
    tablesCol(id).get(),
    goalsCol(id).get(),
  ])

  // Firestore batches aceitam até 500 escritas — divide se necessário
  const allDeletes = [
    ...ordersSnap.docs.map((d) => d.ref),
    ...productsSnap.docs.map((d) => d.ref),
    ...categoriesSnap.docs.map((d) => d.ref),
    ...goalsSnap.docs.map((d) => d.ref),
    ...tablesSnap.docs.map((d) => d.ref),
    ...usersSnap.docs.map((d) => d.ref),
    ...tablesSnap.docs.map((d) => qrLookupCol().doc((d.data() as { qrToken?: string }).qrToken ?? '__none__')),
    ref,
  ]
  for (let i = 0; i < allDeletes.length; i += 450) {
    const batch = ref.firestore.batch()
    for (const docRef of allDeletes.slice(i, i + 450)) batch.delete(docRef)
    await batch.commit()
  }

  // Remove também as contas do Firebase Auth desse tenant
  await Promise.all(usersSnap.docs.map((d) => adminAuth.deleteUser(d.id).catch(() => {})))

  broadcast('dados:alterados', { type: 'platform' })
  return NextResponse.json({ ok: true })
}

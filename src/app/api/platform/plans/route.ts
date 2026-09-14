import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { PLATFORM_ROLES } from '@/lib/permissions'

/** GET /api/platform/plans — planos comerciais (cargos de gestão da plataforma) */
export async function GET() {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const plans = await db.plan.findMany({ orderBy: { sortOrder: 'asc' } })
  // Conta assinantes por plano (estabelecimentos ativos no plano)
  const grouped = await db.establishment.groupBy({ by: ['plan'], _count: { _all: true } })
  const counts = new Map(grouped.map((g) => [g.plan, g._count._all]))
  return NextResponse.json({
    plans: plans.map((p) => ({ ...p, subscribers: counts.get(p.key) ?? 0 })),
  })
}

type PlanBody = { key?: string; name?: string; price?: number; duration?: number; features?: string; sortOrder?: number }

/** POST /api/platform/plans — cria plano (cargos de gestão da plataforma) */
export async function POST(req: NextRequest) {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const body = await readJson<PlanBody>(req)
  const key = body?.key?.trim().toUpperCase()
  const name = body?.name?.trim()
  if (!key || !/^[A-Z0-9_]{2,20}$/.test(key)) return bad('Chave do plano inválida (A-Z, números e _)')
  if (!name) return bad('Informe o nome do plano')
  try {
    const plan = await db.plan.create({
      data: {
        key,
        name,
        price: Math.max(0, Number(body?.price) || 0),
        duration: Math.max(1, Math.round(body?.duration ?? 30)),
        features: (body?.features ?? '').slice(0, 1000),
        sortOrder: Math.max(0, Math.round(body?.sortOrder ?? 99)),
      },
    })
    return NextResponse.json({ plan })
  } catch {
    return bad('Já existe um plano com essa chave', 409)
  }
}

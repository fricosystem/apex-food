import { NextRequest, NextResponse } from 'next/server'
import { plansCol, establishmentsCol } from '@/lib/fs'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { PLATFORM_ROLES } from '@/lib/permissions'

/** GET /api/platform/plans — planos comerciais (cargos de gestão da plataforma) */
export async function GET() {
  const auth = await requireUser([...PLATFORM_ROLES])
  if (isResponse(auth)) return auth
  const [plansSnap, estsSnap] = await Promise.all([
    plansCol().orderBy('sortOrder', 'asc').get(),
    establishmentsCol().select('plan').get(),
  ])
  const counts = new Map<string, number>()
  for (const d of estsSnap.docs) {
    const plan = (d.data() as { plan?: string }).plan ?? 'TRIAL'
    counts.set(plan, (counts.get(plan) ?? 0) + 1)
  }
  return NextResponse.json({
    plans: plansSnap.docs.map((d) => ({ id: d.id, ...d.data(), subscribers: counts.get(d.id) ?? 0 })),
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

  const ref = plansCol().doc(key)
  if ((await ref.get()).exists) return bad('Já existe um plano com essa chave', 409)

  const data = {
    key,
    name,
    price: Math.max(0, Number(body?.price) || 0),
    duration: Math.max(1, Math.round(body?.duration ?? 30)),
    features: (body?.features ?? '').slice(0, 1000),
    sortOrder: Math.max(0, Math.round(body?.sortOrder ?? 99)),
  }
  await ref.set(data)
  return NextResponse.json({ plan: { id: key, ...data } })
}

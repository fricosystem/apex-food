import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

/** GET /api/settings — configurações do estabelecimento da sessão */
export async function GET() {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const rows = await db.setting.findMany({ where: { establishmentId: auth.establishmentId } })
  const settings: Record<string, string> = {}
  for (const r of rows) settings[r.key] = r.value
  return NextResponse.json({ settings, establishment: auth.establishment })
}

/** PATCH /api/settings — body: { [key]: value }; dados cadastrais vão para o Establishment */
export async function PATCH(req: NextRequest) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  let body: Record<string, string> = {}
  try {
    body = (await req.json()) as Record<string, string>
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const allowed = new Set([
    'establishmentName', 'establishmentType', 'establishmentLogo', 'establishmentPhone', 'establishmentAddress',
    'distributionRule', 'confirmTimeout', 'alertThreshold', 'soundEnabled',
    'acceptCredit', 'acceptDebit', 'acceptPix', 'acceptCash', 'defaultGoal',
  ])

  // Dados cadastrais → Establishment (fonte da verdade multi-tenant)
  const estData: Record<string, string> = {}
  if (typeof body.establishmentName === 'string' && body.establishmentName.trim()) estData.name = body.establishmentName.trim().slice(0, 80)
  if (typeof body.establishmentType === 'string' && body.establishmentType.trim()) estData.type = body.establishmentType.trim()
  if (typeof body.establishmentLogo === 'string' && body.establishmentLogo.trim()) estData.logo = body.establishmentLogo.trim().slice(0, 8)
  if (typeof body.establishmentPhone === 'string') estData.phone = body.establishmentPhone.trim().slice(0, 32)
  if (typeof body.establishmentAddress === 'string') estData.address = body.establishmentAddress.trim().slice(0, 160)
  if (Object.keys(estData).length > 0) {
    await db.establishment.update({ where: { id: auth.establishmentId }, data: estData })
  }

  // Preferências operacionais → Setting por estabelecimento
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.has(key) || key.startsWith('establishment')) continue
    await db.setting.upsert({
      where: { establishmentId_key: { establishmentId: auth.establishmentId, key } },
      create: { establishmentId: auth.establishmentId, key, value: String(value) },
      update: { value: String(value) },
    })
  }

  broadcast('dados:alterados', { type: 'settings' })
  const rows = await db.setting.findMany({ where: { establishmentId: auth.establishmentId } })
  const settings: Record<string, string> = {}
  for (const r of rows) settings[r.key] = r.value
  return NextResponse.json({ settings, establishment: auth.establishment })
}

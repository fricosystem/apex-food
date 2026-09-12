import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

/** PATCH /api/settings — body: { [key]: value } */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  let body: Record<string, string> = {}
  try {
    body = (await req.json()) as Record<string, string>
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const allowed = new Set([
    'establishmentName', 'establishmentType', 'establishmentLogo',
    'distributionRule', 'confirmTimeout', 'alertThreshold', 'soundEnabled',
    'acceptCredit', 'acceptDebit', 'acceptPix', 'acceptCash', 'defaultGoal',
  ])
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.has(key)) continue
    await db.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    })
  }
  broadcast('dados:alterados', { type: 'settings' })
  const rows = await db.setting.findMany()
  const settings: Record<string, string> = {}
  for (const r of rows) settings[r.key] = r.value
  return NextResponse.json({ settings })
}

import { NextRequest, NextResponse } from 'next/server'
import { tablesCol, ordersCol, qrLookupCol, randomToken, tsToIso } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

const ACTIVE_STATUSES = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']

export async function GET() {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth

  const [tablesSnap, activeOrdersSnap] = await Promise.all([
    tablesCol(auth.establishmentId).orderBy('number', 'asc').get(),
    ordersCol(auth.establishmentId).where('status', 'in', ACTIVE_STATUSES).get(),
  ])

  // Mais recente por mesa (createdAt desc)
  const activeByTable = new Map<string, { id: string; createdAt: unknown } & Record<string, unknown>>()
  for (const d of activeOrdersSnap.docs) {
    const o = { id: d.id, ...d.data() } as { tableId: string; createdAt: unknown } & Record<string, unknown>
    const cur = activeByTable.get(o.tableId)
    if (!cur || (o.createdAt as { toMillis?: () => number })?.toMillis?.() > (cur.createdAt as { toMillis?: () => number })?.toMillis?.()) {
      activeByTable.set(o.tableId, o)
    }
  }

  const rows = tablesSnap.docs.map((d) => {
    const t = { id: d.id, ...d.data() } as { id: string; number: number; capacity: number; active: boolean; status: string; qrToken: string }
    const active = activeByTable.get(t.id) as ({ id: string; code: string; status: string; total: number; items?: unknown[]; createdAt: unknown }) | undefined
    return {
      id: t.id,
      number: t.number,
      capacity: t.capacity,
      active: t.active,
      status: t.active ? (t.status === 'FREE' ? 'FREE' : t.status) : 'FREE',
      qrToken: t.qrToken,
      activeOrder: active
        ? { id: active.id, code: active.code, status: active.status, total: active.total, itemCount: (active.items ?? []).length, createdAt: tsToIso(active.createdAt) }
        : null,
    }
  })
  return NextResponse.json({ tables: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const body = await readJson<{ number?: number; capacity?: number }>(req)
  const number = Number(body?.number)
  if (!number || number < 1) return bad('Informe um número de mesa válido')

  const dup = await tablesCol(auth.establishmentId).where('number', '==', number).limit(1).get()
  if (!dup.empty) return bad('Já existe uma mesa com esse número', 409)

  const token = randomToken()
  const data = {
    number,
    capacity: Math.max(1, Number(body?.capacity) || 4),
    active: true,
    status: 'FREE',
    qrToken: token,
    createdAt: new Date(),
  }
  const ref = await tablesCol(auth.establishmentId).add(data)
  await qrLookupCol().doc(token).set({ establishmentId: auth.establishmentId, tableId: ref.id })
  broadcast('mesa:atualizada', { tableId: ref.id })
  return NextResponse.json({ table: { id: ref.id, ...data } })
}

import { NextRequest, NextResponse } from 'next/server'
import { tablesCol, ordersCol, qrLookupCol, countDocs, tsToIso } from '@/lib/fs'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }
const ACTIVE_STATUSES = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT']

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{ capacity?: number; active?: boolean }>(req)
  const ref = tablesCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Mesa não encontrada', 404)
  const existing = snap.data() as { capacity: number; active: boolean; status: string }

  if (body?.active === false) {
    const activeOrders = await countDocs(ordersCol(auth.establishmentId).where('tableId', '==', id).where('status', 'in', ACTIVE_STATUSES))
    if (activeOrders > 0) return bad('Mesa possui comanda em andamento. Finalize antes de desativar.')
  }

  const data = {
    capacity: body?.capacity ? Math.max(1, Number(body.capacity)) : existing.capacity,
    active: body?.active ?? existing.active,
    status: body?.active === false ? 'FREE' : existing.status,
  }
  await ref.update(data)
  broadcast('mesa:atualizada', { tableId: id })
  return NextResponse.json({ table: { id, ...existing, ...data, createdAt: tsToIso((existing as { createdAt?: unknown }).createdAt) } })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireTenant(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const ref = tablesCol(auth.establishmentId).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return bad('Mesa não encontrada', 404)
  const activeOrders = await countDocs(ordersCol(auth.establishmentId).where('tableId', '==', id).where('status', 'in', ACTIVE_STATUSES))
  if (activeOrders > 0) return bad('Mesa possui comanda em andamento.')

  // Remove também o histórico de comandas dessa mesa (mesmo comportamento de antes)
  const allOrders = await ordersCol(auth.establishmentId).where('tableId', '==', id).get()
  const batch = ref.firestore.batch()
  for (const d of allOrders.docs) batch.delete(d.ref)
  batch.delete(ref)
  const qrToken = (snap.data() as { qrToken?: string })?.qrToken
  if (qrToken) batch.delete(qrLookupCol().doc(qrToken))
  await batch.commit()

  broadcast('mesa:atualizada', { tableId: id })
  return NextResponse.json({ ok: true })
}

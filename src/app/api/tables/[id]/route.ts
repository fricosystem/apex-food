import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const body = await readJson<{ capacity?: number; active?: boolean }>(req)
  const existing = await db.restaurantTable.findUnique({ where: { id } })
  if (!existing) return bad('Mesa não encontrada', 404)

  const activeOrders = await db.order.count({
    where: { tableId: id, status: { in: ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT'] } },
  })
  if (body?.active === false && activeOrders > 0) {
    return bad('Mesa possui comanda em andamento. Finalize antes de desativar.')
  }

  const table = await db.restaurantTable.update({
    where: { id },
    data: {
      capacity: body?.capacity ? Math.max(1, Number(body.capacity)) : existing.capacity,
      active: body?.active ?? existing.active,
      status: body?.active === false ? 'FREE' : existing.status,
    },
  })
  broadcast('mesa:atualizada', { tableId: table.id })
  return NextResponse.json({ table })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(['ADMIN', 'MANAGER'])
  if (isResponse(auth)) return auth
  const { id } = await params
  const activeOrders = await db.order.count({
    where: { tableId: id, status: { in: ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT'] } },
  })
  if (activeOrders > 0) return bad('Mesa possui comanda em andamento.')
  await db.order.deleteMany({ where: { tableId: id } })
  await db.restaurantTable.delete({ where: { id } })
  broadcast('mesa:atualizada', { tableId: id })
  return NextResponse.json({ ok: true })
}

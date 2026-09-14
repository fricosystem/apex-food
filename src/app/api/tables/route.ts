import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenant, isResponse, readJson, bad } from '@/lib/api'
import { broadcast } from '@/lib/realtime'

export async function GET() {
  const auth = await requireTenant()
  if (isResponse(auth)) return auth
  const tables = await db.restaurantTable.findMany({
    where: { establishmentId: auth.establishmentId },
    orderBy: { number: 'asc' },
    include: {
      orders: {
        where: { status: { in: ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT'] } },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  const rows = tables.map((t) => {
    const active = t.orders[0]
    return {
      id: t.id,
      number: t.number,
      capacity: t.capacity,
      active: t.active,
      status: t.active ? (t.status === 'FREE' ? 'FREE' : t.status) : 'FREE',
      qrToken: t.qrToken,
      activeOrder: active
        ? {
            id: active.id,
            code: active.code,
            status: active.status,
            total: active.total,
            itemCount: active.items.length,
            createdAt: active.createdAt,
          }
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
  const exists = await db.restaurantTable.findFirst({
    where: { establishmentId: auth.establishmentId, number },
  })
  if (exists) return bad('Já existe uma mesa com esse número', 409)
  const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  const table = await db.restaurantTable.create({
    data: { number, capacity: Math.max(1, Number(body?.capacity) || 4), qrToken: token, establishmentId: auth.establishmentId },
  })
  broadcast('mesa:atualizada', { tableId: table.id })
  return NextResponse.json({ table })
}

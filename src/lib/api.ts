import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, SessionUser } from '@/lib/auth'

export type ApiContext = { params: Promise<Record<string, string>> }

export async function requireUser(roles?: string[]): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão para esta ação' }, { status: 403 })
  }
  return user
}

/**
 * Autenticação com escopo de estabelecimento (tenant).
 * Super admin (desenvolvedor) não opera dados de um restaurante — recebe 403.
 */
export async function requireTenant(roles?: string[]): Promise<(SessionUser & { establishmentId: string }) | NextResponse> {
  const user = await requireUser(roles)
  if (isResponse(user)) return user
  if (!user.establishment) {
    return NextResponse.json({ error: 'Ação exclusiva de estabelecimentos' }, { status: 403 })
  }
  return { ...user, establishmentId: user.establishment.id }
}

export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse
}

export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** Serializa comandas vindas do Prisma para DTO plano */
export function serializeOrder(o: any) {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    total: o.total,
    createdAt: o.createdAt,
    confirmedAt: o.confirmedAt,
    finishedAt: o.finishedAt,
    paidAt: o.paidAt,
    tableId: o.tableId,
    tableNumber: o.table?.number ?? 0,
    waiterId: o.waiterId,
    waiterName: o.waiter?.name ?? null,
    paymentMethod: o.payments?.[0]?.method ?? null,
    items: (o.items ?? []).map((it: any) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      notes: it.notes,
      unitPrice: it.unitPrice,
      station: it.station,
      prepTime: it.prepTime,
      status: it.status,
      startedAt: it.startedAt,
      readyAt: it.readyAt,
      servedAt: it.servedAt,
      emoji: it.product?.emoji ?? '🍽️',
    })),
  }
}

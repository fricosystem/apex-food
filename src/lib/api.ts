import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, SessionUser } from '@/lib/auth'
import { tsToIso } from '@/lib/fs'

export type ApiContext = { params: Promise<Record<string, string>> }

/**
 * DESENVOLVEDOR (dono da plataforma) tem acesso de 100% a todos os módulos e
 * funções do sistema — passa por qualquer checagem de `roles` abaixo. É a
 * ÚNICA excessão: nenhuma outra rota (nem `platform/**`) aceita um cargo fora
 * da lista explicitamente passada. Continua exigindo estar autenticado.
 */
export async function requireUser(roles?: string[]): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (user.role === 'DESENVOLVEDOR') return user
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão para esta ação' }, { status: 403 })
  }
  return user
}

/**
 * Autenticação com escopo de estabelecimento (tenant).
 * Um DESENVOLVEDOR sem estabelecimento vinculado (o "dono da plataforma" puro)
 * não tem dados de restaurante para operar — recebe 403 aqui como qualquer
 * outro usuário sem estabelecimento. Se o DESENVOLVEDOR também estiver
 * vinculado a um estabelecimento (ex.: conta de testes), passa normalmente.
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

/** Formato de item de comanda gravado no array `items` do doc do Firestore (ver plano_firebase.md) */
export type OrderItemRow = {
  id: string
  productId: string
  productName: string
  quantity: number
  notes: string
  unitPrice: number
  station: string
  prepTime: number
  status: string
  startedAt: unknown
  readyAt: unknown
  servedAt: unknown
  emoji: string
}

export type OrderPaymentRow = { method: string; amount: number; cashierId: string | null; createdAt: unknown } | null

export type OrderDoc = {
  code: string
  status: string
  total: number
  createdAt: unknown
  confirmedAt: unknown
  finishedAt: unknown
  paidAt: unknown
  tableId: string
  tableNumber: number
  waiterId: string | null
  waiterName: string | null
  rating: number | null
  ratedAt: unknown
  items: OrderItemRow[]
  payment: OrderPaymentRow
}

/** Serializa uma comanda (doc Firestore, com id) para a DTO plana que o front-end espera */
export function serializeOrder(o: OrderDoc & { id: string }) {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    total: o.total,
    createdAt: tsToIso(o.createdAt),
    confirmedAt: tsToIso(o.confirmedAt),
    finishedAt: tsToIso(o.finishedAt),
    paidAt: tsToIso(o.paidAt),
    tableId: o.tableId,
    tableNumber: o.tableNumber ?? 0,
    waiterId: o.waiterId,
    waiterName: o.waiterName ?? null,
    paymentMethod: o.payment?.method ?? null,
    rating: o.rating ?? null,
    ratedAt: tsToIso(o.ratedAt),
    items: (o.items ?? []).map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      notes: it.notes,
      unitPrice: it.unitPrice,
      station: it.station,
      prepTime: it.prepTime,
      status: it.status,
      startedAt: tsToIso(it.startedAt),
      readyAt: tsToIso(it.readyAt),
      servedAt: tsToIso(it.servedAt),
      emoji: it.emoji ?? '🍽️',
    })),
  }
}

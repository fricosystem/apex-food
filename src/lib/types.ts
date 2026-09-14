export type Role = 'ADMIN' | 'MANAGER' | 'WAITER' | 'KITCHEN' | 'CASHIER'

export type ViewKey = 'dashboard' | 'garcom' | 'cozinha' | 'caixa' | 'gestao' | 'mesas' | 'relatorio' | 'configuracoes'

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRM: 'Aguardando garçom',
  IN_KITCHEN: 'Na cozinha',
  AWAITING_PAYMENT: 'Aguardando caixa',
  PAID: 'Concluída',
  CANCELLED: 'Cancelada',
}

export const ITEM_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Na fila',
  IN_PREPARATION: 'Em preparo',
  READY: 'Pronto',
  SERVED: 'Servido',
}

export const SECTOR_LABELS: Record<string, string> = {
  KITCHEN: 'Cozinha',
  GRILL: 'Churrasqueira',
  PIZZERIA: 'Pizzaria',
  BAR: 'Bar',
}

export const PAYMENT_LABELS: Record<string, string> = {
  CREDIT: 'Cartão de Crédito',
  DEBIT: 'Cartão de Débito',
  PIX: 'PIX',
  CASH: 'Dinheiro Físico',
}

export const TABLE_STATUS_LABELS: Record<string, string> = {
  FREE: 'Livre',
  OCCUPIED: 'Ocupada',
  AWAITING_PAYMENT: 'Aguardando caixa',
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  WAITER: 'Garçom',
  KITCHEN: 'Cozinha',
  CASHIER: 'Caixa',
}

export type OrderItemDTO = {
  id: string
  productId: string
  productName: string
  quantity: number
  notes: string
  unitPrice: number
  station: string
  prepTime: number
  status: string
  startedAt: string | null
  readyAt: string | null
  servedAt: string | null
  emoji: string
}

export type OrderDTO = {
  id: string
  code: string
  status: string
  total: number
  createdAt: string
  confirmedAt: string | null
  finishedAt: string | null
  paidAt: string | null
  tableId: string
  tableNumber: number
  waiterId: string | null
  waiterName: string | null
  paymentMethod: string | null
  items: OrderItemDTO[]
}

export function currency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function elapsedMinutes(from: string | Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 60000))
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}min`
}

export function timeAgo(from: string | Date): string {
  const secs = Math.floor((Date.now() - new Date(from).getTime()) / 1000)
  if (secs < 60) return 'agora'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

export function clockTime(from: string | Date): string {
  return new Date(from).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

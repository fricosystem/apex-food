import crypto from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { resolveViewRoles } from '@/lib/permissions'

const SECRET = process.env.AUTH_SECRET || 'apex-food-2026-secret-key'
export const SESSION_COOKIE = 'apex_session'
const SESSION_HOURS = 12

/**
 * Atributos do cookie de sessão.
 * Em HTTPS (preview/proxy) usa SameSite=None + Partitioned + Secure para o cookie
 * funcionar dentro de iframes cross-site; em HTTP local mantém Lax.
 */
export function sessionCookieAttributes(proto: string | null | undefined) {
  const isHttps = (proto ?? '').split(',')[0].trim() === 'https'
  return {
    httpOnly: true as const,
    path: '/',
    maxAge: SESSION_HOURS * 3600,
    ...(isHttps
      ? { sameSite: 'none' as const, secure: true, partitioned: true as const }
      : { sameSite: 'lax' as const }),
  }
}

export type SessionEstablishment = {
  id: string
  name: string
  cnpj: string
  logo: string
  type: string
  phone: string
  address: string
  active: boolean
  plan: string
  billingStatus: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  lastPaymentAt: string | null
  notes: string
}

export type SessionUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  establishment: SessionEstablishment | null
  permissions: Record<string, string[]>
}

/** Monta o payload de sessão a partir do usuário + estabelecimento (com override de permissões) */
export function buildSessionUser(user: {
  id: string; name: string; email: string; role: string; status: string
  establishment?: {
    id: string; name: string; cnpj: string; logo: string; type: string; phone: string; address: string
    active: boolean; plan: string; billingStatus: string
    trialEndsAt: Date | null; currentPeriodEnd: Date | null; lastPaymentAt: Date | null
    notes: string; permissions: string
  } | null
}): SessionUser {
  const est = user.establishment
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    establishment: est
      ? {
          id: est.id,
          name: est.name,
          cnpj: est.cnpj,
          logo: est.logo,
          type: est.type,
          phone: est.phone,
          address: est.address,
          active: est.active,
          plan: est.plan,
          billingStatus: est.billingStatus,
          trialEndsAt: est.trialEndsAt?.toISOString() ?? null,
          currentPeriodEnd: est.currentPeriodEnd?.toISOString() ?? null,
          lastPaymentAt: est.lastPaymentAt?.toISOString() ?? null,
          notes: est.notes,
        }
      : null,
    permissions: resolveViewRoles(est?.permissions ?? null),
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const candidate = crypto.scryptSync(password, salt, 32).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
  } catch {
    return false
  }
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function createToken(userId: string): string {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readToken(token: string | undefined): string | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!data.uid || Date.now() > data.exp) return null
    return data.uid
  } catch {
    return null
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const uid = readToken(store.get(SESSION_COOKIE)?.value)
  if (!uid) return null
  const user = await db.user.findUnique({
    where: { id: uid },
    select: {
      id: true, name: true, email: true, role: true, status: true, active: true,
      establishment: {
        select: {
          id: true, name: true, cnpj: true, logo: true, type: true, phone: true, address: true,
          active: true, plan: true, billingStatus: true,
          trialEndsAt: true, currentPeriodEnd: true, lastPaymentAt: true,
          notes: true, permissions: true,
        },
      },
    },
  })
  if (!user || !user.active) return null
  // Estabelecimento desativado (suspenso pela plataforma) → sessão inválida
  if (user.establishment && !user.establishment.active) return null
  return buildSessionUser(user)
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Desenvolvedor CEO',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  WAITER: 'Garçom',
  KITCHEN: 'Cozinha',
  CASHIER: 'Caixa',
}

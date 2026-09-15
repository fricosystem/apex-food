import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase-admin'
import { usersCol, establishmentsCol, tsToIso } from '@/lib/fs'
import { resolveViewRoles } from '@/lib/permissions'

export const SESSION_COOKIE = 'apex_session'
const SESSION_DAYS = 5
const SESSION_MS = SESSION_DAYS * 24 * 3600 * 1000

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
    maxAge: SESSION_DAYS * 86_400,
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
    trialEndsAt: unknown; currentPeriodEnd: unknown; lastPaymentAt: unknown
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
          trialEndsAt: tsToIso(est.trialEndsAt),
          currentPeriodEnd: tsToIso(est.currentPeriodEnd),
          lastPaymentAt: tsToIso(est.lastPaymentAt),
          notes: est.notes,
        }
      : null,
    permissions: resolveViewRoles(est?.permissions ?? null),
  }
}

/** Busca o doc users/{uid} + (se houver) o estabelecimento vinculado, prontos para buildSessionUser */
export async function loadUserForSession(uid: string) {
  const snap = await usersCol().doc(uid).get()
  if (!snap.exists) return null
  const u = snap.data() as {
    name: string; email: string; role: string; status: string; active: boolean; establishmentId?: string | null
  }
  if (!u.active) return null
  let establishment = null
  if (u.establishmentId) {
    const estSnap = await establishmentsCol().doc(u.establishmentId).get()
    if (!estSnap.exists) return null
    const e = estSnap.data() as { active: boolean }
    // DESENVOLVEDOR nunca é bloqueado por estabelecimento suspenso/vencido — sem
    // aviso de plano e sem limite do sistema para esse cargo (mesmo se vinculado
    // a um estabelecimento, ex.: conta de testes).
    if (!e.active && u.role !== 'DESENVOLVEDOR') return null
    establishment = { id: estSnap.id, ...(estSnap.data() as object) } as NonNullable<
      Parameters<typeof buildSessionUser>[0]['establishment']
    >
  }
  return { id: uid, name: u.name, email: u.email, role: u.role, status: u.status, establishment }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const cookie = store.get(SESSION_COOKIE)?.value
  if (!cookie) return null
  let uid: string
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true)
    uid = decoded.uid
  } catch {
    return null
  }
  const user = await loadUserForSession(uid)
  if (!user) return null
  return buildSessionUser(user)
}

/** Troca um idToken (obtido via signInWithPassword) por um cookie de sessão httpOnly */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_MS })
}

/**
 * Verifica e-mail/senha contra o Firebase Authentication.
 * O Admin SDK não expõe "signIn" (isso é uma operação de client) — usamos a REST
 * pública do Identity Toolkit a partir do servidor, com a Web API Key (pública).
 * https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password
 */
export async function signInWithPassword(email: string, password: string): Promise<{ idToken: string; uid: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY não configurada')
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  if (!res.ok) return null
  const data = (await res.json()) as { idToken: string; localId: string }
  return { idToken: data.idToken, uid: data.localId }
}

export const ROLE_LABELS: Record<string, string> = {
  DESENVOLVEDOR: 'Desenvolvedor CEO',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  WAITER: 'Garçom',
  KITCHEN: 'Cozinha',
  CASHIER: 'Caixa',
}

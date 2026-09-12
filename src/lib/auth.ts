import crypto from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const SECRET = process.env.AUTH_SECRET || 'apex-food-2026-secret-key'
export const SESSION_COOKIE = 'apex_session'
const SESSION_HOURS = 12

export type SessionUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
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
    select: { id: true, name: true, email: true, role: true, status: true, active: true },
  })
  if (!user || !user.active) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status }
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  WAITER: 'Garçom',
  KITCHEN: 'Cozinha',
  CASHIER: 'Caixa',
}

import { NextRequest, NextResponse } from 'next/server'
import { signInWithPassword, createSessionCookie, loadUserForSession, SESSION_COOKIE, sessionCookieAttributes, buildSessionUser } from '@/lib/auth'
import { readJson, bad } from '@/lib/api'

export async function POST(req: NextRequest) {
  const body = await readJson<{ email?: string; password?: string }>(req)
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password
  if (!email || !password) return bad('Informe e-mail e senha')

  const signIn = await signInWithPassword(email, password).catch(() => null)
  if (!signIn) return bad('Credenciais inválidas. Verifique e tente novamente.', 401)

  const user = await loadUserForSession(signIn.uid)
  // user inativo, ou estabelecimento suspenso/cancelado pela plataforma → bloqueia o login
  if (!user) return bad('Credenciais inválidas ou conta suspensa. Entre em contato com o suporte APEX FOOD.', 403)

  const sessionCookie = await createSessionCookie(signIn.idToken)
  const res = NextResponse.json({ user: buildSessionUser(user) })
  res.cookies.set(SESSION_COOKIE, sessionCookie, sessionCookieAttributes(req.headers.get('x-forwarded-proto')))
  return res
}

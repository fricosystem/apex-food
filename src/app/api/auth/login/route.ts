import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createToken, SESSION_COOKIE, sessionCookieAttributes, buildSessionUser } from '@/lib/auth'
import { readJson, bad } from '@/lib/api'

export async function POST(req: NextRequest) {
  const body = await readJson<{ email?: string; password?: string }>(req)
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password
  if (!email || !password) return bad('Informe e-mail e senha')

  const user = await db.user.findUnique({
    where: { email },
    include: { establishment: true },
  })
  if (!user || !user.active || !verifyPassword(password, user.password)) {
    return bad('Credenciais inválidas. Verifique e tente novamente.', 401)
  }
  // Estabelecimento suspenso/cancelado pela plataforma → bloqueia o login
  if (user.establishment && !user.establishment.active) {
    return bad('Estabelecimento suspenso. Entre em contato com o suporte APEX FOOD.', 403)
  }

  const res = NextResponse.json({ user: buildSessionUser(user) })
  res.cookies.set(SESSION_COOKIE, createToken(user.id), sessionCookieAttributes(req.headers.get('x-forwarded-proto')))
  return res
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createToken, SESSION_COOKIE } from '@/lib/auth'
import { readJson, bad } from '@/lib/api'

export async function POST(req: NextRequest) {
  const body = await readJson<{ email?: string; password?: string }>(req)
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password
  if (!email || !password) return bad('Informe e-mail e senha')

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !user.active || !verifyPassword(password, user.password)) {
    return bad('Credenciais inválidas. Verifique e tente novamente.', 401)
  }

  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status },
  })
  res.cookies.set(SESSION_COOKIE, createToken(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 3600,
  })
  return res
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createToken, SESSION_COOKIE, sessionCookieAttributes, buildSessionUser } from '@/lib/auth'
import { readJson, bad } from '@/lib/api'

const TRIAL_DAYS = 14

/**
 * POST /api/auth/register — cadastro self-service de um novo restaurante.
 * Cria o estabelecimento (plano TESTE, 14 dias) + usuário ADMIN (proprietário) e autentica.
 */
export async function POST(req: NextRequest) {
  const body = await readJson<{ restaurantName?: string; ownerName?: string; email?: string; password?: string }>(req)
  const restaurantName = body?.restaurantName?.trim()
  const ownerName = body?.ownerName?.trim()
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password

  if (!restaurantName || restaurantName.length < 2) return bad('Informe o nome do restaurante')
  if (!ownerName) return bad('Informe o seu nome')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Informe um e-mail válido')
  if (!password || password.length < 6) return bad('A senha deve ter pelo menos 6 caracteres')

  const emailExists = await db.user.findUnique({ where: { email } })
  if (emailExists) return bad('Este e-mail já está cadastrado. Faça login.', 409)

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000)

  try {
    const user = await db.$transaction(async (tx) => {
      const establishment = await tx.establishment.create({
        data: {
          name: restaurantName.slice(0, 80),
          logo: '🍴',
          type: 'RESTAURANTE',
          plan: 'TRIAL',
          billingStatus: 'TRIAL',
          periodStartAt: new Date(),
          trialEndsAt,
          notes: 'Cadastro self-service',
        },
      })
      // Configurações padrão do estabelecimento
      for (const [key, value] of [
        ['distributionRule', 'least_active'], ['confirmTimeout', '5'], ['alertThreshold', '20'],
        ['soundEnabled', 'true'], ['acceptCredit', 'true'], ['acceptDebit', 'true'],
        ['acceptPix', 'true'], ['acceptCash', 'true'], ['defaultGoal', '50'],
      ] as const) {
        await tx.setting.create({ data: { establishmentId: establishment.id, key, value } })
      }
      return tx.user.create({
        data: {
          name: ownerName.slice(0, 80),
          email,
          password: hashPassword(password),
          role: 'ADMIN',
          status: 'ONLINE',
          establishmentId: establishment.id,
        },
        include: { establishment: true },
      })
    })

    const res = NextResponse.json({ user: buildSessionUser(user) })
    res.cookies.set(SESSION_COOKIE, createToken(user.id), sessionCookieAttributes(req.headers.get('x-forwarded-proto')))
    return res
  } catch {
    return bad('Não foi possível concluir o cadastro. Tente novamente.', 500)
  }
}

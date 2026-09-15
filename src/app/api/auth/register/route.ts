import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { establishmentsCol, usersCol } from '@/lib/fs'
import { signInWithPassword, createSessionCookie, SESSION_COOKIE, sessionCookieAttributes, buildSessionUser } from '@/lib/auth'
import { readJson, bad } from '@/lib/api'

const TRIAL_DAYS = 14

const DEFAULT_SETTINGS = {
  distributionRule: 'least_active',
  confirmTimeout: '5',
  alertThreshold: '20',
  soundEnabled: 'true',
  acceptCredit: 'true',
  acceptDebit: 'true',
  acceptPix: 'true',
  acceptCash: 'true',
  defaultGoal: '50',
}

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

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000)
  const now = new Date()

  let uid: string
  try {
    const created = await adminAuth.createUser({ email, password, displayName: ownerName })
    uid = created.uid
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'auth/email-already-exists') return bad('Este e-mail já está cadastrado. Faça login.', 409)
    if (code === 'auth/invalid-password' || code === 'auth/password-does-not-meet-requirements') {
      return bad('Senha muito simples. Use letras maiúsculas, minúsculas, números e um símbolo.', 400)
    }
    console.error('register createUser failed:', e)
    return bad('Não foi possível concluir o cadastro. Tente novamente.', 500)
  }

  try {
    const estRef = establishmentsCol().doc()
    await estRef.set({
      name: restaurantName.slice(0, 80),
      cnpj: '',
      logo: '🍴',
      type: 'RESTAURANTE',
      phone: '',
      address: '',
      active: true,
      plan: 'TRIAL',
      billingStatus: 'TRIAL',
      trialEndsAt,
      currentPeriodEnd: null,
      periodStartAt: now,
      lastPaymentAt: null,
      notes: 'Cadastro self-service',
      permissions: '{}',
      settings: DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    })

    await usersCol().doc(uid).set({
      name: ownerName.slice(0, 80),
      email,
      role: 'ADMIN',
      status: 'ONLINE',
      active: true,
      establishmentId: estRef.id,
      createdAt: now,
    })

    const signIn = await signInWithPassword(email, password)
    if (!signIn) return bad('Cadastro criado, mas o login automático falhou. Tente entrar manualmente.', 500)
    const sessionCookie = await createSessionCookie(signIn.idToken)

    const sessionUser = buildSessionUser({
      id: uid,
      name: ownerName.slice(0, 80),
      email,
      role: 'ADMIN',
      status: 'ONLINE',
      establishment: {
        id: estRef.id, name: restaurantName.slice(0, 80), cnpj: '', logo: '🍴', type: 'RESTAURANTE',
        phone: '', address: '', active: true, plan: 'TRIAL', billingStatus: 'TRIAL',
        trialEndsAt, currentPeriodEnd: null, lastPaymentAt: null, notes: 'Cadastro self-service', permissions: '{}',
      },
    })
    const res = NextResponse.json({ user: sessionUser })
    res.cookies.set(SESSION_COOKIE, sessionCookie, sessionCookieAttributes(req.headers.get('x-forwarded-proto')))
    return res
  } catch (e) {
    console.error('register failed:', e)
    // Firestore falhou depois de criar o Auth user — desfaz para não deixar conta órfã
    await adminAuth.deleteUser(uid).catch(() => {})
    return bad('Não foi possível concluir o cadastro. Tente novamente.', 500)
  }
}

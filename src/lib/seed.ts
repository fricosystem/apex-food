import { plansCol } from '@/lib/fs'

/**
 * Planos comerciais da plataforma (configuração, não dado fictício de restaurante).
 * Ver plano_firebase.md, seção 5 — dados fictícios de demonstração (estabelecimento,
 * usuários, produtos, comandas) foram removidos: o primeiro acesso real é sempre via
 * POST /api/auth/register (cria o estabelecimento + admin) ou por um usuário DESENVOLVEDOR
 * criado manualmente.
 */
const PLANS = [
  { key: 'TRIAL', name: 'Teste grátis', price: 0, duration: 14, sortOrder: 0, features: 'Todos os módulos liberados\nAté 10 funcionários\nSuporte por e-mail' },
  { key: 'BASIC', name: 'Básico', price: 99.9, duration: 30, sortOrder: 1, features: 'Comandas, cozinha e caixa\nCardápio digital com QR\nAté 15 funcionários\nSuporte em horário comercial' },
  { key: 'PRO', name: 'Pro', price: 189.9, duration: 30, sortOrder: 2, features: 'Tudo do Básico\nDashboard completo e relatórios\nMesas ilimitadas\nPermissões por cargo\nSuporte prioritário' },
  { key: 'PREMIUM', name: 'Premium', price: 329.9, duration: 30, sortOrder: 3, features: 'Tudo do Pro\nMúltiplas unidades\nGestão de refeições\nSuporte 24/7 com atendimento dedicado' },
]

/** Garante que os planos comerciais existam. Idempotente. */
export async function ensurePlans(): Promise<boolean> {
  const snap = await plansCol().limit(1).get()
  if (!snap.empty) return false
  const batch = plansCol().firestore.batch()
  for (const p of PLANS) {
    batch.set(plansCol().doc(p.key), p)
  }
  await batch.commit()
  return true
}

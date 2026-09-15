import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Firebase Admin SDK — usado SÓ no servidor (rotas de API, nunca no
 * navegador). Ignora as Firestore Rules por design: quem valida permissão
 * de acesso é a própria rota (src/lib/api.ts: requireUser/requireTenant),
 * como já acontecia com o Prisma.
 *
 * Requer as variáveis de ambiente:
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID (reaproveitado do client)
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 * (da service account: Console Firebase > Configurações do projeto >
 * Contas de serviço > Gerar nova chave privada)
 */
const globalForAdmin = globalThis as unknown as { firebaseAdminApp?: App }

function buildApp(): App {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // .env costuma escapar as quebras de linha da private_key como "\n" literal
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDK não configurado: defina FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env ' +
        '(veja plano_firebase.md, seção "Fase 0 — Credenciais").',
    )
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

export const firebaseAdminApp = globalForAdmin.firebaseAdminApp ?? getApps()[0] ?? buildApp()
if (process.env.NODE_ENV !== 'production') globalForAdmin.firebaseAdminApp = firebaseAdminApp

export const adminAuth = getAuth(firebaseAdminApp)
export const adminDb = getFirestore(firebaseAdminApp)

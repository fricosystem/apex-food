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

/**
 * Limpa uma variável de ambiente colada manualmente (painel da Vercel, etc.):
 * remove aspas externas que a UI não sabe que são só delimitador do .env
 * (ex.: copiar `FIREBASE_PRIVATE_KEY="-----BEGIN...`  literalmente) e espaços
 * nas pontas. Sem isso, a chave privada vem com `"` colada no PEM e o
 * `cert()` falha silenciosamente com erro de parsing.
 */
function cleanEnvValue(v: string | undefined): string | undefined {
  if (!v) return v
  const trimmed = v.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function buildApp(): App {
  const projectId = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  const clientEmail = cleanEnvValue(process.env.FIREBASE_CLIENT_EMAIL)
  // .env costuma escapar as quebras de linha da private_key como "\n" literal
  const privateKey = cleanEnvValue(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDK não configurado: defina FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env ' +
        '(veja plano_firebase.md, seção "Fase 0 — Credenciais").',
    )
  }

  try {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  } catch (e) {
    // Erro mais comum aqui: FIREBASE_PRIVATE_KEY colada com aspas extras ou
    // com as quebras de linha reais removidas ao copiar/colar na Vercel.
    throw new Error(
      `Firebase Admin SDK: falha ao inicializar com as credenciais fornecidas (${(e as Error).message}). ` +
        'Confira se FIREBASE_PRIVATE_KEY foi colada sem aspas extras e com o PEM completo (-----BEGIN...-----END-----).',
    )
  }
}

export const firebaseAdminApp = globalForAdmin.firebaseAdminApp ?? getApps()[0] ?? buildApp()
if (process.env.NODE_ENV !== 'production') globalForAdmin.firebaseAdminApp = firebaseAdminApp

export const adminAuth = getAuth(firebaseAdminApp)
export const adminDb = getFirestore(firebaseAdminApp)

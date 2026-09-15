import { Timestamp, type DocumentData, type Query } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'

/**
 * Helpers de acesso ao Firestore — nomes de coleção e conversões comuns.
 * Estrutura (ver plano_firebase.md, seção 3):
 *   plans/{key}
 *   users/{uid}                          (uid = Firebase Auth UID)
 *   qrLookup/{token}                     ({ establishmentId, tableId })
 *   establishments/{estId}
 *     /tables/{id}  /categories/{id}  /products/{id}  /goals/{id}  /orders/{id}
 */
export const plansCol = () => adminDb.collection('plans')
export const usersCol = () => adminDb.collection('users')
export const qrLookupCol = () => adminDb.collection('qrLookup')
export const establishmentsCol = () => adminDb.collection('establishments')

export const tablesCol = (estId: string) => establishmentsCol().doc(estId).collection('tables')
export const categoriesCol = (estId: string) => establishmentsCol().doc(estId).collection('categories')
export const productsCol = (estId: string) => establishmentsCol().doc(estId).collection('products')
export const goalsCol = (estId: string) => establishmentsCol().doc(estId).collection('goals')
export const ordersCol = (estId: string) => establishmentsCol().doc(estId).collection('orders')

/** Timestamp do Firestore (ou Date/undefined) → ISO string, para as DTOs que o front-end espera */
export function tsToIso(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (v instanceof Date) return v.toISOString()
  return null
}

/** Converte todos os campos Timestamp de um objeto plano para ISO string (1 nível) */
export function serializeTimestamps<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): T {
  const out = { ...obj }
  for (const k of keys) {
    ;(out as Record<string, unknown>)[k as string] = tsToIso(obj[k])
  }
  return out
}

export function randomToken(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

/** doc().id gera um ID novo sem precisar escrever — útil para pré-gerar IDs referenciados entre documentos */
export function newId(colRef: { doc: () => { id: string } }): string {
  return colRef.doc().id
}

/** Conta documentos de uma query com a Aggregation API (1 leitura, não N) */
export async function countDocs(q: Query<DocumentData>): Promise<number> {
  const snap = await q.count().get()
  return snap.data().count
}

/**
 * Rate limiting simples em memória — primeira camada contra força bruta em
 * login/registro. Limitação real: cada instância serverless da Vercel tem
 * sua própria memória (reseta em cold start, não é compartilhado entre
 * regiões/instâncias) — não substitui uma solução distribuída de verdade
 * (Vercel Firewall, ou um contador em Upstash Redis/Vercel KV) para proteção
 * robusta em produção com tráfego real. Ainda assim, já dificulta um script
 * simples de tentativa-e-erro batendo repetidamente na mesma instância.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

// Evita crescimento infinito do Map em uma instância de vida longa
function sweep(now: number) {
  if (buckets.size < 5000) return
  for (const [key, b] of buckets) if (now > b.resetAt) buckets.delete(key)
}

/** true = liberado; false = excedeu o limite (responda 429) */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  sweep(now)
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count++
  return true
}

/** IP do cliente a partir dos headers de proxy (Vercel/Next sempre roda atrás de um) */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

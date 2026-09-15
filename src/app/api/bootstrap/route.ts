import { NextResponse } from 'next/server'
import { ensurePlans } from '@/lib/seed'

/** Garante que os planos comerciais da plataforma existam. Idempotente. Sem dados fictícios. */
export async function POST() {
  try {
    const seeded = await ensurePlans()
    return NextResponse.json({ ok: true, seeded })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

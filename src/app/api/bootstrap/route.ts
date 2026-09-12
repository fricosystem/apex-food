import { NextResponse } from 'next/server'
import { ensureSeed } from '@/lib/seed'

/** Garante que o banco tenha dados iniciais. Idempotente. */
export async function POST() {
  try {
    const seeded = await ensureSeed()
    return NextResponse.json({ ok: true, seeded })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

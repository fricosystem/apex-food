import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, sessionCookieAttributes } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieAttributes(req.headers.get('x-forwarded-proto')),
    maxAge: 0,
  })
  return res
}

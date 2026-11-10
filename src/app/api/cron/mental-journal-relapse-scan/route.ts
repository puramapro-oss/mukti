// Retired endpoint, kept inert for older scheduler configurations.
// It never reads a journal, evaluates a person, or creates a notification.
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  const supplied = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret ?? ''}`)
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, enabled: false, alerted: 0 }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export const GET = POST

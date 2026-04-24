// CRON : fait avancer les phases des événements C.O.R.E. en cours.
// scheduled → live dès T-60, live → finished à T+15.
// Toutes les minutes.

import { NextResponse } from 'next/server'
import { advanceAllLiveEvents } from '@/lib/core-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization') ?? ''
  if (secret && header === `Bearer ${secret}`) return true
  if (req.headers.get('x-vercel-cron')) return true
  return false
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  }
  try {
    const result = await advanceAllLiveEvents()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'CRON failure.' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  return POST(req)
}

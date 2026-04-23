// CRON : passe les cérémonies upcoming → live dès que scheduled_at est atteint.
// Appelé toutes les 5 minutes par Vercel.

import { NextResponse } from 'next/server'
import { autoStartCeremonies } from '@/lib/ar-ceremony'

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
    const { started } = await autoStartCeremonies()
    return NextResponse.json({ ok: true, started })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'CRON failure.' },
      { status: 500 },
    )
  }
}

export async function GET(req: Request) {
  return POST(req)
}

// CRON quotidien — débloque les paliers dont locked_until ≤ now.
// Transfère wallet.pending_cents → balance_cents + insère wallet_transaction unlocked.
// Appelé par Vercel Cron ou manuellement via Bearer CRON_SECRET.

import { NextResponse } from 'next/server'
import { unlockExpiredMilestones } from '@/lib/streaks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization') ?? ''
  if (secret && header === `Bearer ${secret}`) return true
  if (req.headers.get('x-vercel-cron')) return true
  return false
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json(
      { error: 'Accès refusé. Cette route est réservée au planificateur.' },
      { status: 401 },
    )
  }

  try {
    const { unlocked_count } = await unlockExpiredMilestones()
    return NextResponse.json({
      ok: true,
      unlocked_count,
      at: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'inconnu'
    return NextResponse.json({ ok: false, error: `Échec unlock — ${msg}` }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}

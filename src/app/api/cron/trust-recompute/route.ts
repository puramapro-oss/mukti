// CRON nightly — recompute le trust score de tous les users actifs (sessions 7j).
// Idempotent par user. Limite 500 users/batch pour rester < maxDuration.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { recomputeTrustScore } from '@/lib/trust'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

  const admin = createServiceClient()
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  try {
    // Unique users ayant au moins 1 session mode récente (activité 7j)
    const { data: rows, error } = await admin
      .from('mode_sessions')
      .select('user_id')
      .gte('started_at', weekAgo)
      .limit(500)

    if (error) {
      return NextResponse.json({ ok: false, error: `Lecture sessions échouée — ${error.message}` }, { status: 500 })
    }

    const uniqueUsers = Array.from(new Set((rows ?? []).map(r => r.user_id as string)))
    let recomputed = 0
    let failed = 0
    const errors: string[] = []

    for (const userId of uniqueUsers) {
      try {
        await recomputeTrustScore(userId)
        recomputed++
      } catch (e) {
        failed++
        if (errors.length < 5) errors.push(`${userId}: ${e instanceof Error ? e.message : 'inconnu'}`)
      }
    }

    return NextResponse.json({
      ok: true,
      users_checked: uniqueUsers.length,
      recomputed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      at: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'inconnu'
    return NextResponse.json({ ok: false, error: `Échec recompute — ${msg}` }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}

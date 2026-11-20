// Compatibility URL: free daily acknowledgement, with no financial reward.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { claimDailyChest, RecognitionError } from '@/lib/mystery-rewards'
import { RECOGNITION_FORMAT, RECOGNITION_TIME_ZONE } from '@/lib/daily-recognition'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour enregistrer ta journée.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  // Retries are safe: the database owns the daily unique key, even across servers.
  const rl = rateLimit(`mystery:claim:${user.id}:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  try {
    const result = await claimDailyChest()
    return NextResponse.json({
      ok: true,
      format: RECOGNITION_FORMAT,
      time_zone: RECOGNITION_TIME_ZONE,
      recognition: result.recognition,
      already_recorded: result.alreadyClaimed,
      // Compatibility fields never contain an invented legacy reward.
      reward: null,
      already_claimed: result.alreadyClaimed,
      financial_value: false,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof RecognitionError ? error.message : 'Enregistrement indisponible. Réessaie plus tard.',
    }, { status: error instanceof RecognitionError ? error.status : 503 })
  }
}

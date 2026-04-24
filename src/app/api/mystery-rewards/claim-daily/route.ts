// POST /api/mystery-rewards/claim-daily — réclame le coffre quotidien (1/user/date idempotent).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { claimDailyChest } from '@/lib/mystery-rewards'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour ouvrir ton coffre.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  // Rate 10/h — suffisant pour retry en cas de freeze client ; la vraie limite = UNIQUE DB
  const rl = rateLimit(`mystery:claim:${user.id}:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const result = await claimDailyChest()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({
    reward: result.reward,
    already_claimed: result.alreadyClaimed,
  })
}

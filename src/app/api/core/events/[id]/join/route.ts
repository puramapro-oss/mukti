// POST /api/core/events/[id]/join — rejoint un événement C.O.R.E.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { joinEvent } from '@/lib/core-events'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour rejoindre cet événement.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`core:events:join:${user.id}:${ip}`, 30, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const { id } = await ctx.params
  const result = await joinEvent(id)
  if (result.error) {
    const status = result.error.includes('introuvable') ? 404 : 400
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ participant: result.participant })
}

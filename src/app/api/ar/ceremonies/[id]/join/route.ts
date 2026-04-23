// POST /api/ar/ceremonies/[id]/join — participation du user (auth)

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { joinCeremony } from '@/lib/ar-ceremony'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Cérémonie introuvable.' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) {
    return NextResponse.json({ error: 'Connexion requise pour rejoindre.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`ar:ceremony:join:${profileId}:${ip}`, 20, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const result = await joinCeremony(id, profileId)
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : result.code === 'full' ? 409 : result.code === 'finished' ? 410 : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ ok: true, participant: result.participant })
}

// POST /api/ar/ceremonies/[id]/leave — quitte la cérémonie (auth)

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { leaveCeremony, markCeremonyCompleted } from '@/lib/ar-ceremony'
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
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`ar:ceremony:leave:${profileId}:${ip}`, 30, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  // Si l'appel vient avec body {completed:true}, marque aussi complete
  const json = await req.json().catch(() => null)
  if (json && typeof json === 'object' && (json as { completed?: boolean }).completed) {
    await markCeremonyCompleted(id, profileId)
  }

  const result = await leaveCeremony(id, profileId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

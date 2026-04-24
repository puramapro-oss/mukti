// POST /api/core/events/[id]/generate-ai — génère un Event Pack via Claude (super_admin only).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { generateEventPack } from '@/lib/event-pack-ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const srv = createServiceClient()
  const { data: profile } = await srv
    .schema('mukti')
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if ((profile as { role: string } | null)?.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Accès réservé aux modérateurs.' },
      { status: 403 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`core:events:ai:${user.id}:${ip}`, 20, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const { id } = await ctx.params
  const { data: event } = await srv
    .schema('mukti')
    .from('core_events')
    .select('format, category, severity, title_fr, title_en, region')
    .eq('id', id)
    .maybeSingle()
  if (!event) {
    return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 })
  }

  const pack = await generateEventPack(
    event as {
      format: 'human' | 'animal' | 'one_planet'
      category: string
      severity: number
      title_fr: string
      title_en: string
      region: string | null
    } as Parameters<typeof generateEventPack>[0]
  )
  if (!pack) {
    return NextResponse.json({ error: "Impossible de générer l'Event Pack." }, { status: 500 })
  }

  await srv
    .schema('mukti')
    .from('core_events')
    .update({
      ai_pack: pack,
      ar_protocol_id: pack.ar_protocol,
      intention_fr: pack.intention_fr,
      intention_en: pack.intention_en,
    })
    .eq('id', id)

  return NextResponse.json({ pack })
}

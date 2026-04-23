// POST /api/circles/[id]/livekit-token — génère un token JWT LiveKit pour le participant authentifié
// Requiert : circle.audio_mode === 'sfu' + user est dans circle_participants actif

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { generateLiveKitToken, isLiveKitConfigured } from '@/lib/livekit'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id || typeof id !== 'string' || id.length < 8) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  if (!isLiveKitConfigured()) {
    return NextResponse.json(
      { error: 'Configuration audio haute capacité non disponible. Contacte le support.' },
      { status: 503 },
    )
  }

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`circles:livekit:${ip}`, 30, 600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  // vérifie participant actif + circle SFU
  const service = createServiceClient()
  const { data: cp } = await service
    .from('circle_participants')
    .select('id, mic_muted, role')
    .eq('circle_id', id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle()

  if (!cp) {
    return NextResponse.json({ error: 'Tu dois rejoindre le cercle avant de te connecter à l\'audio.' }, { status: 403 })
  }

  const { data: circle } = await service
    .from('circles')
    .select('audio_mode, status, livekit_room_name')
    .eq('id', id)
    .maybeSingle()

  if (!circle) {
    return NextResponse.json({ error: 'Cercle introuvable.' }, { status: 404 })
  }

  const c = circle as { audio_mode: string; status: string; livekit_room_name: string | null }
  if (c.audio_mode !== 'sfu') {
    return NextResponse.json(
      { error: 'Ce cercle utilise le mode audio direct (mesh), pas besoin de token.' },
      { status: 409 },
    )
  }
  if (c.status !== 'live' && c.status !== 'open') {
    return NextResponse.json({ error: 'Le cercle est clôturé.' }, { status: 410 })
  }

  // Récupère full_name user pour identity friendly
  const { data: profile } = await service
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const userName = (profile as { full_name?: string } | null)?.full_name ?? user.email?.split('@')[0] ?? 'Âme'
  const muted = (cp as { mic_muted?: boolean }).mic_muted === true

  try {
    const { token, url, roomName } = await generateLiveKitToken({
      circleId: id,
      userId: user.id,
      userName,
      canPublish: !muted,
      canSubscribe: true,
    })

    return NextResponse.json({ ok: true, token, url, roomName, muted })
  } catch {
    return NextResponse.json({ error: 'Impossible de générer le jeton audio. Réessaie.' }, { status: 500 })
  }
}

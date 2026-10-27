// POST /api/circles/[id]/livekit-token — authenticated SFU members only.
// Optional { listenOnly: true } narrows the token; it never bypasses circle membership.
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
    return NextResponse.json({ error: 'Configuration audio haute capacité non disponible. Contacte le support.' }, { status: 503 })
  }
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const ip = getClientIp(req)
  const rl = rateLimit(`circles:livekit:${ip}`, 30, 600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  let listenOnly = false
  try {
    // Bound bytes while reading, not just an untrusted Content-Length header.
    const reader = req.body?.getReader()
    let bytes = 0
    const chunks: Uint8Array[] = []
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 1024) {
            void reader.cancel().catch(() => undefined)
            return NextResponse.json({ error: 'Demande trop volumineuse.' }, { status: 413 })
          }
          chunks.push(value)
        }
      } finally { reader.releaseLock() }
    }
    const buffer = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(buffer).trim()
    if (raw) {
      const body: unknown = JSON.parse(raw)
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'listenOnly') ||
        ('listenOnly' in body && typeof body.listenOnly !== 'boolean')) {
        return NextResponse.json({ error: 'Mode audio invalide.' }, { status: 400 })
      }
      listenOnly = 'listenOnly' in body && body.listenOnly === true
    }
  } catch {
    return NextResponse.json({ error: 'Demande audio invalide.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: cp } = await service.from('circle_participants')
    .select('id, mic_muted, role').eq('circle_id', id).eq('user_id', user.id)
    .is('left_at', null).maybeSingle()
  if (!cp) {
    return NextResponse.json({ error: 'Tu dois rejoindre le cercle avant de te connecter à l’audio.' }, { status: 403 })
  }
  const { data: circle } = await service.from('circles')
    .select('audio_mode, status, livekit_room_name').eq('id', id).maybeSingle()
  if (!circle) return NextResponse.json({ error: 'Cercle introuvable.' }, { status: 404 })
  const c = circle as { audio_mode: string; status: string; livekit_room_name: string | null }
  if (c.audio_mode !== 'sfu') {
    return NextResponse.json({ error: 'Ce cercle utilise le mode audio direct (mesh), pas le relais d’écoute.' }, { status: 409 })
  }
  if (c.status !== 'live' && c.status !== 'open') {
    return NextResponse.json({ error: 'Le cercle est clôturé.' }, { status: 410 })
  }
  const { data: profile } = await service.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const userName = (profile as { full_name?: string } | null)?.full_name ?? user.email?.split('@')[0] ?? 'Âme'
  const muted = listenOnly || (cp as { mic_muted?: boolean }).mic_muted === true
  try {
    const { token, url, roomName } = await generateLiveKitToken({
      circleId: id, userId: user.id, userName,
      canPublish: !muted, canSubscribe: true, listenOnly,
    })
    return NextResponse.json({ ok: true, token, url, roomName, muted, listenOnly }, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch {
    return NextResponse.json({ error: 'Impossible de générer le jeton audio. Réessaie.' }, { status: 500 })
  }
}

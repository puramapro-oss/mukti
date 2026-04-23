// POST /api/circles/[id]/report — signaler un participant (auto-mute si ≥3 reports distincts)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkReportsAutoMute } from '@/lib/circles'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const BodySchema = z.object({
  reported_user_id: z.string().uuid(),
  reason: z.enum(['hate', 'disruption', 'medical_claim', 'spam', 'harassment', 'other']),
  note: z.string().trim().max(500).optional(),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id || typeof id !== 'string' || id.length < 8) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`circles:report:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Trop de signalements — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Motif de signalement invalide.' }, { status: 400 })
  }

  if (parsed.data.reported_user_id === user.id) {
    return NextResponse.json({ error: 'Tu ne peux pas te signaler toi-même.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error: insErr } = await service.from('circle_reports').insert({
    circle_id: id,
    reporter_id: user.id,
    reported_user_id: parsed.data.reported_user_id,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
  })

  if (insErr && !insErr.message.includes('duplicate key')) {
    return NextResponse.json({ error: 'Signalement impossible. Réessaie.' }, { status: 400 })
  }

  const muted = await checkReportsAutoMute(id, parsed.data.reported_user_id)

  return NextResponse.json({
    ok: true,
    auto_muted: muted,
    message: muted ? 'Merci. Le participant a été automatiquement coupé.' : 'Merci, signalement pris en compte.',
  })
}

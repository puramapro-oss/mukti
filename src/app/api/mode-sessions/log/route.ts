// POST /api/mode-sessions/log
// Log d'une session des 5 modes MVP (coupure_40s / multisensoriel / micro_meditation / avatar / compteur).
// Feed le trust score en arrière-plan.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MODES_G2, type ModeId } from '@/lib/constants'
import { recomputeTrustScore } from '@/lib/trust'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const MODE_IDS = MODES_G2.map(m => m.id) as [ModeId, ...ModeId[]]

const BodySchema = z.object({
  mode: z.enum(MODE_IDS),
  addiction_id: z.string().uuid().optional(),
  duration_sec: z.number().int().min(0).max(3600).optional(),
  urge_before: z.number().int().min(1).max(10).optional(),
  urge_after: z.number().int().min(1).max(10).optional(),
  outcome: z.enum(['resisted', 'relapsed', 'interrupted', 'completed']).optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  sensor_data: z.record(z.string(), z.unknown()).optional(),
  client_fingerprint: z.string().trim().max(120).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const ip = getClientIp(req)
  const rl = rateLimit(`mode:log:${ip}:${user.id}`, 50, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Trop de sessions loggées — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 },
    )
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })

  if (parsed.data.addiction_id) {
    const { data: addictionRow } = await sb
      .from('addictions')
      .select('id')
      .eq('id', parsed.data.addiction_id)
      .maybeSingle()
    if (!addictionRow) {
      return NextResponse.json({ error: 'Addiction introuvable.' }, { status: 404 })
    }
  }

  const { data, error } = await sb
    .from('mode_sessions')
    .insert({
      user_id: profile.id,
      addiction_id: parsed.data.addiction_id ?? null,
      mode: parsed.data.mode,
      started_at: parsed.data.started_at ?? new Date().toISOString(),
      completed_at: parsed.data.completed_at ?? null,
      duration_sec: parsed.data.duration_sec ?? null,
      urge_before: parsed.data.urge_before ?? null,
      urge_after: parsed.data.urge_after ?? null,
      outcome: parsed.data.outcome ?? null,
      sensor_data: parsed.data.sensor_data ?? {},
      client_fingerprint: parsed.data.client_fingerprint ?? null,
      client_ip: ip === 'unknown' ? null : ip,
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: `Impossible de logger la session — ${error?.message ?? 'inconnu'}` },
      { status: 500 },
    )
  }

  // Recompute trust en fire-and-forget (ne bloque pas la réponse)
  void recomputeTrustScore(profile.id).catch(() => {})

  return NextResponse.json({ ok: true, session: data }, { status: 201 })
}

// POST /api/mode-sessions/log — the existing mode_sessions primary key also
// identifies a retried client session. No parallel table, ledger or score.
import { isDeepStrictEqual } from 'node:util'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MODES_G2, type ModeId } from '@/lib/constants'
import { recomputeTrustScore } from '@/lib/trust'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15
const MODE_IDS = MODES_G2.map(mode => mode.id) as [ModeId, ...ModeId[]]
const BodySchema = z.object({
  client_session_id: z.string().uuid().optional(),
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
}).superRefine((body, context) => {
  if (body.client_session_id && !body.started_at) context.addIssue({
    code: 'custom', path: ['started_at'], message: 'La date de début est requise pour reprendre la même séance.',
  })
})

const reply = (body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
const unconfirmed = () => reply({ error: 'Enregistrement non confirmé. Réessaie avec les mêmes réponses.' }, 503)

function samePayload(stored: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) => {
    if ((key === 'started_at' || key === 'completed_at') && typeof value === 'string') {
      return typeof stored[key] === 'string' && Date.parse(stored[key]) === Date.parse(value)
    }
    return isDeepStrictEqual(stored[key], value)
  })
}

export async function POST(req: Request) {
  try {
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return reply({ error: 'Connexion requise.' }, 401)
    const ip = getClientIp(req)
    const limit = rateLimit(`mode:log:${ip}:${user.id}`, 50, 3600)
    if (!limit.ok) return reply({ error: `Trop de sessions loggées — réessaie dans ${limit.retryAfterSec}s.` }, 429,
      { 'Retry-After': String(limit.retryAfterSec) })
    const parsed = BodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, 400)

    const { data: profile } = await sb.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!profile) return reply({ error: 'Profil introuvable.' }, 404)
    if (parsed.data.addiction_id) {
      const { data: addiction } = await sb.from('addictions').select('id').eq('id', parsed.data.addiction_id).maybeSingle()
      if (!addiction) return reply({ error: 'Addiction introuvable.' }, 404)
    }

    const input = parsed.data
    const id = input.client_session_id?.toLowerCase()
    const values = {
      user_id: profile.id,
      addiction_id: input.addiction_id?.toLowerCase() ?? null,
      mode: input.mode,
      started_at: input.started_at ? new Date(input.started_at).toISOString() : new Date().toISOString(),
      completed_at: input.completed_at ? new Date(input.completed_at).toISOString() : null,
      duration_sec: input.duration_sec ?? null,
      urge_before: input.urge_before ?? null,
      urge_after: input.urge_after ?? null,
      outcome: input.outcome ?? null,
      sensor_data: input.sensor_data ?? {},
      client_fingerprint: input.client_fingerprint ?? null,
    }
    const { data, error } = await sb.from('mode_sessions').insert({
      ...values, ...(id ? { id } : {}), client_ip: ip === 'unknown' ? null : ip,
    }).select('*').single()

    if (error?.code === '23505' && id) {
      // RLS remains active. Both predicates are mandatory, even if a service
      // configuration were accidentally to return a row belonging to someone else.
      const { data: existing, error: readError } = await sb.from('mode_sessions').select('*')
        .eq('id', id).eq('user_id', profile.id).maybeSingle()
      if (readError) return unconfirmed()
      if (!existing || existing.id !== id || !samePayload(existing, values)) return reply({
        error: 'Enregistrement non confirmé : cet identifiant de séance ne peut pas être réutilisé avec ces données.',
      }, 409)
      return reply({ ok: true, session: existing, replayed: true }, 200)
    }
    if (error || !data) return unconfirmed()
    // Preserve the existing score calculation, once for a newly inserted row.
    void recomputeTrustScore(profile.id).catch(() => {})
    return reply({ ok: true, session: data }, 201)
  } catch {
    // No database details, payload or other account's existence in the response.
    return unconfirmed()
  }
}

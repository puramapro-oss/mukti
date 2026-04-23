// PATCH /api/reprogramming/notifs-preferences — toggle opt-in rappels Mode Journée.
// Stocké dans profiles.notifs (JSONB) → clé reprog_day_reminders (boolean).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 10

const PrefsSchema = z.object({
  reprog_day_reminders: z.boolean(),
})

export async function PATCH(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour modifier tes préférences.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`notifs:prefs:${user.id}:${ip}`, 30, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = PrefsSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  // Résout profile + lit notifs courants pour merge
  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id, notifs')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const row = profile as { id: string; notifs: Record<string, unknown> | null } | null
  if (!row?.id) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  }

  const nextNotifs = {
    ...(row.notifs ?? {}),
    reprog_day_reminders: parsed.data.reprog_day_reminders,
  }

  const service = createServiceClient()
  const { error: updateErr } = await service
    .schema('mukti')
    .from('profiles')
    .update({ notifs: nextNotifs })
    .eq('id', row.id)

  if (updateErr) {
    return NextResponse.json(
      { error: 'Impossible de sauvegarder ta préférence.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    reprog_day_reminders: parsed.data.reprog_day_reminders,
  })
}

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`notifs:prefs:get:${user.id}:${ip}`, 120, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('notifs')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const notifs = (profile as { notifs: Record<string, unknown> | null } | null)?.notifs ?? {}

  return NextResponse.json({
    ok: true,
    reprog_day_reminders: Boolean((notifs as Record<string, unknown>).reprog_day_reminders),
  })
}

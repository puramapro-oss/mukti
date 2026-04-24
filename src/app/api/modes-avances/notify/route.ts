// POST /api/modes-avances/notify — enregistre "notifie-moi" pour un mode teaser.
// Rate 20/h. Persiste dans profiles.notifs->advanced_modes_notify (array dédupliqué).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { ADVANCED_MODES } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const ModeIds = ADVANCED_MODES.map(m => m.id) as [string, ...string[]]
const NotifySchema = z.object({
  mode_id: z.enum(ModeIds),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour être notifié.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`modes-avances:notify:${user.id}:${ip}`, 20, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = NotifySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'mode_id invalide.' },
      { status: 400 }
    )
  }

  const modeId = parsed.data.mode_id
  const meta = ADVANCED_MODES.find(m => m.id === modeId)
  if (!meta) {
    return NextResponse.json({ error: 'Mode inconnu.' }, { status: 400 })
  }
  if (meta.status !== 'teaser') {
    return NextResponse.json(
      { error: 'Ce mode est déjà disponible — utilise-le directement.' },
      { status: 400 }
    )
  }

  // Résolution profile + lecture notifs actuels
  const service = createServiceClient()
  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id, notifs')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const profileRow = profile as {
    id: string
    notifs: Record<string, unknown> | null
  } | null
  if (!profileRow) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  }

  const current = (profileRow.notifs ?? {}) as Record<string, unknown>
  const existing = Array.isArray(current.advanced_modes_notify)
    ? (current.advanced_modes_notify as string[])
    : []
  const already = existing.includes(modeId)

  const nextList = already ? existing : [...existing, modeId]
  const nextNotifs = { ...current, advanced_modes_notify: nextList }

  const { error: updErr } = await service
    .schema('mukti')
    .from('profiles')
    .update({ notifs: nextNotifs })
    .eq('id', profileRow.id)

  if (updErr) {
    return NextResponse.json(
      { error: 'Impossible d\'enregistrer — réessaie.' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      already,
      mode_id: modeId,
      mode_name: meta.name,
      notified_modes: nextList,
    },
    { status: 200 }
  )
}

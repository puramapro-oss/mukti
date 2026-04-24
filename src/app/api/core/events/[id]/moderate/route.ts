// POST /api/core/events/[id]/moderate — super_admin moderate draft/auto-published event.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { createTrilogySessions } from '@/lib/core-events'
import type { CoreProtocolId } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const ModerateSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

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

  // super_admin check via profiles.role
  const srv = createServiceClient()
  const { data: profile } = await srv
    .schema('mukti')
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const profileRow = profile as { id: string; role: string } | null
  if (!profileRow || profileRow.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Accès réservé aux modérateurs.' },
      { status: 403 }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = ModerateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Action invalide.' }, { status: 400 })
  }

  const { id } = await ctx.params
  const { data: event } = await srv
    .schema('mukti')
    .from('core_events')
    .select('id, status, moment_z_at, ar_protocol_id')
    .eq('id', id)
    .maybeSingle()
  if (!event) {
    return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 })
  }
  const ev = event as {
    id: string
    status: string
    moment_z_at: string
    ar_protocol_id: string | null
  }

  const newStatus = parsed.data.action === 'approve' ? 'scheduled' : 'rejected'
  const { error } = await srv
    .schema('mukti')
    .from('core_events')
    .update({
      status: newStatus,
      moderated_at: new Date().toISOString(),
      moderated_by: profileRow.id,
    })
    .eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Impossible de modérer.' }, { status: 500 })
  }

  if (parsed.data.action === 'approve' && ev.ar_protocol_id) {
    // Ensure trilogy sessions exist (idempotent on FK)
    const { data: existing } = await srv
      .schema('mukti')
      .from('core_event_sessions')
      .select('kind')
      .eq('event_id', id)
    const existingKinds = new Set(((existing ?? []) as { kind: string }[]).map(s => s.kind))
    if (existingKinds.size === 0) {
      await createTrilogySessions(
        id,
        new Date(ev.moment_z_at),
        ev.ar_protocol_id as CoreProtocolId
      )
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}

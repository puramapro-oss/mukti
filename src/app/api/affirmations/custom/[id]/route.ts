// DELETE /api/affirmations/custom/[id] — soft delete (active = false) avec ownership check.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 10

const IdSchema = z.string().uuid()

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
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
  const rl = rateLimit(`affirm:delete:${user.id}:${ip}`, 30, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const { id } = await ctx.params
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  // Résout profile_id depuis auth_user_id (mukti.profiles.auth_user_id → .id)
  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const profileId = (profile as { id: string } | null)?.id
  if (!profileId) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  }

  const service = createServiceClient()
  const { data: existing, error: readErr } = await service
    .schema('mukti')
    .from('affirmation_custom')
    .select('id, user_id, active')
    .eq('id', id)
    .eq('user_id', profileId)
    .maybeSingle()

  if (readErr || !existing) {
    return NextResponse.json({ error: 'Affirmation introuvable.' }, { status: 404 })
  }

  if (!(existing as { active: boolean }).active) {
    return NextResponse.json({ ok: true, already_inactive: true })
  }

  const { error: updateErr } = await service
    .schema('mukti')
    .from('affirmation_custom')
    .update({ active: false })
    .eq('id', id)
    .eq('user_id', profileId)

  if (updateErr) {
    return NextResponse.json(
      { error: 'Impossible de retirer cette affirmation.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const BodySchema = z.object({
  mission_id: z.string().uuid(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, purama_points, wallet_balance, xp')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })

  const { data: mission } = await admin
    .from('missions')
    .select('*')
    .eq('id', parsed.data.mission_id)
    .eq('active', true)
    .maybeSingle()
  if (!mission) return NextResponse.json({ error: 'Mission introuvable.' }, { status: 404 })

  // Already completed?
  const { data: existing } = await admin
    .from('mission_completions')
    .select('id, status')
    .eq('user_id', profile.id)
    .eq('mission_id', mission.id)
    .maybeSingle()

  if (existing && existing.status === 'validated') {
    return NextResponse.json({ error: 'Mission déjà validée.' }, { status: 409 })
  }

  const { data: completion, error } = await admin
    .from('mission_completions')
    .insert({
      user_id: profile.id,
      mission_id: mission.id,
      status: 'validated',
      reward_paid: true,
      reward_paid_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !completion) {
    return NextResponse.json({ error: 'Validation impossible.' }, { status: 500 })
  }

  const newBalance = Number(profile.wallet_balance ?? 0) + Number(mission.reward_euros ?? 0)
  const newPoints = (profile.purama_points ?? 0) + (mission.reward_points ?? 0)

  await admin
    .from('profiles')
    .update({
      wallet_balance: newBalance,
      purama_points: newPoints,
      xp: (profile.xp ?? 0) + 25,
    })
    .eq('id', profile.id)

  if (Number(mission.reward_euros) > 0) {
    await admin.from('wallet_transactions').insert({
      user_id: profile.id,
      amount: Number(mission.reward_euros),
      type: 'mission',
      source_id: mission.id,
      description: `Mission : ${mission.title}`,
    })
  }

  return NextResponse.json({ ok: true, completion_id: completion.id })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { APP_URL } from '@/lib/constants'

export const runtime = 'nodejs'

const STORY_TYPES = ['streak', 'palier', 'mission', 'gains', 'classement', 'achievement', 'scan'] as const
const STORY_DAILY_MAX = 3
const STORY_REWARD_POINTS = 300

const BodySchema = z.object({
  type: z.enum(STORY_TYPES),
  headline: z.string().trim().min(1).max(120).optional(),
  value: z.string().trim().min(1).max(40).optional(),
  sub: z.string().trim().min(1).max(120).optional(),
  shared_to: z.enum(['instagram', 'tiktok', 'whatsapp', 'twitter', 'facebook', 'snapchat', 'telegram', 'copy', 'native']).optional(),
})

function buildImageUrl(params: {
  type: string
  headline?: string
  value?: string
  sub?: string
  ref?: string | null
}) {
  const u = new URL('/api/og/story', APP_URL)
  u.searchParams.set('type', params.type)
  if (params.headline) u.searchParams.set('headline', params.headline)
  if (params.value) u.searchParams.set('value', params.value)
  if (params.sub) u.searchParams.set('sub', params.sub)
  if (params.ref) u.searchParams.set('ref', params.ref)
  return u.toString()
}

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, purama_points, xp, referral_code')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })

  // Daily cap : max 3 story shares per 24h give points
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('story_shares')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', profile.id)
    .gte('created_at', since)

  const used = count ?? 0
  const remaining = Math.max(0, STORY_DAILY_MAX - used)
  const grantPoints = remaining > 0
  const points = grantPoints ? STORY_REWARD_POINTS : 0

  const imageUrl = buildImageUrl({
    type: parsed.data.type,
    headline: parsed.data.headline,
    value: parsed.data.value,
    sub: parsed.data.sub,
    ref: profile.referral_code ?? null,
  })

  const { data: share, error: insertErr } = await admin
    .from('story_shares')
    .insert({
      user_id: profile.id,
      type: parsed.data.type,
      payload: {
        headline: parsed.data.headline ?? null,
        value: parsed.data.value ?? null,
        sub: parsed.data.sub ?? null,
      },
      image_url: imageUrl,
      shared_to: parsed.data.shared_to ?? null,
      points_given: points,
    })
    .select('id, created_at, points_given')
    .single()

  if (insertErr || !share) {
    return NextResponse.json({ error: 'Impossible d\'enregistrer le partage.' }, { status: 500 })
  }

  if (grantPoints) {
    await admin
      .from('profiles')
      .update({
        purama_points: (profile.purama_points ?? 0) + STORY_REWARD_POINTS,
        xp: (profile.xp ?? 0) + 15,
      })
      .eq('id', profile.id)
  }

  return NextResponse.json({
    ok: true,
    share_id: share.id,
    image_url: imageUrl,
    points_given: points,
    daily_remaining: Math.max(0, remaining - 1),
    referral_url: profile.referral_code
      ? `${APP_URL}/r/${profile.referral_code}`
      : APP_URL,
  })
}

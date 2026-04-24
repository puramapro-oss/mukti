// MUKTI — G7 Register referral (cookie 30j côté client) + attribution signup
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { attributeReferralSignup } from '@/lib/referrals-v4'
import { REFERRAL_V4 } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const BodySchema = z.object({
  referral_code: z.string().min(2).max(40),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`ref-register:${profileId}`, 10, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Code invalide.' }, { status: 400 })
  const result = await attributeReferralSignup({
    referrerCode: parsed.data.referral_code,
    referredUserId: profileId,
  })
  const res = NextResponse.json({ ok: true, attributed: result.attributed })
  if (result.attributed) {
    res.cookies.set({
      name: 'mukti_ref',
      value: parsed.data.referral_code,
      path: '/',
      maxAge: REFERRAL_V4.cookie_days * 24 * 3600,
      sameSite: 'lax',
    })
  }
  return res
}

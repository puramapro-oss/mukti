// MUKTI — G7 Candidature ambassadeur (auto-approve si ≥ seuil Bronze)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { applyAmbassadeur } from '@/lib/ambassador'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const BodySchema = z.object({
  bio: z.string().min(30).max(500),
  social_links: z.record(z.string(), z.string().url()).optional().default({}),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`ambassadeur-apply:${profileId}`, 5, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  const result = await applyAmbassadeur({
    bio: parsed.data.bio,
    socialLinks: parsed.data.social_links,
  })
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Erreur.' }, { status: 400 })
  return NextResponse.json({ ok: true, tier: result.tier, approved: result.approved })
}

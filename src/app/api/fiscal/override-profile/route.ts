// MUKTI — G7 Override manuel profil fiscal (user a un SIRET etc.)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { resolveProfileId } from '@/lib/ar'
import { FISCAL_PROFILES } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const BodySchema = z.object({
  profile_type: z.enum(FISCAL_PROFILES.map(p => p.id) as [string, ...string[]]),
  siret: z.string().min(14).max(14).optional(),
  legal_name: z.string().min(2).max(200).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`fiscal-override:${profileId}`, 5, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  const admin = createServiceClient()
  await admin.from('fiscal_profiles').upsert({
    user_id: profileId,
    profile_type: parsed.data.profile_type,
    siret: parsed.data.siret ?? null,
    legal_name: parsed.data.legal_name ?? null,
    override_manual: true,
    detected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  return NextResponse.json({ ok: true, profile_type: parsed.data.profile_type })
}

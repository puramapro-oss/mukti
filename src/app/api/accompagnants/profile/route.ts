// MUKTI G8.2 — Profile aidant·e (upsert)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { upsertAidantProfile } from '@/lib/accompagnants'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'
import { AIDANT_LIENS } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const BodySchema = z.object({
  lien_avec_malade: z.enum(AIDANT_LIENS),
  situation: z.string().max(500).optional(),
  energy_level: z.number().int().min(0).max(100).optional(),
  consent_shared_stories: z.boolean().optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`accomp-profile:${profileId}`, 10, 60)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives. Réessaie dans un moment.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }
  const result = await upsertAidantProfile(parsed.data)
  if (!result) return NextResponse.json({ error: 'Erreur enregistrement profil.' }, { status: 500 })
  return NextResponse.json({ ok: true, profile: result })
}

export async function GET() {
  return NextResponse.json({ error: 'Méthode non autorisée. Utilise POST.' }, { status: 405 })
}

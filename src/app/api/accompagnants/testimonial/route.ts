// MUKTI G8.2 — Submit testimonial (modération ultérieure)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { submitTestimonial } from '@/lib/accompagnants'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const BodySchema = z.object({
  content: z.string().min(20).max(2000),
  anonymous: z.boolean().optional().default(true),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`accomp-testimonial:${profileId}`, 3, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Tu as déjà partagé récemment. Merci.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Message trop court ou trop long.' }, { status: 400 })
  }
  const result = await submitTestimonial(parsed.data.content, parsed.data.anonymous)
  if (!result.ok) return NextResponse.json({ error: 'Erreur envoi. Réessaie.' }, { status: 500 })
  return NextResponse.json({ ok: true, id: result.id })
}

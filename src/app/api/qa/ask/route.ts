// MUKTI G8.5 — Q&R Claude Opus + détection détresse
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'
import { askQa } from '@/lib/qa-engine'

export const runtime = 'nodejs'
export const maxDuration = 60

const BodySchema = z.object({
  question: z.string().min(2).max(4000),
  context_page: z.string().max(200).optional(),
  lang: z.string().max(8).optional().default('fr'),
  country_code: z.string().length(2).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`qa-ask:${profileId}`, 30, 300)
  if (!rl.ok) return NextResponse.json({ error: 'Pose-toi un instant. Réessaie dans quelques minutes.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Question invalide.' }, { status: 400 })
  }
  const result = await askQa({
    question: parsed.data.question,
    context_page: parsed.data.context_page,
    lang: parsed.data.lang,
    country_code: parsed.data.country_code,
  })
  return NextResponse.json({
    answer: result.answer,
    distress_score: result.distress_score,
    escalated: result.escalated,
    conversation_id: result.conversation_id,
  })
}

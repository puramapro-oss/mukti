// POST /api/affirmations/suggest — Haiku 4.5 génère 5 affirmations adaptées à la catégorie.
// Rate-limit strict 10/h (Haiku API cost protection).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { suggestAffirmations, isValidCategory } from '@/lib/affirmations-bank'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 30

const SuggestSchema = z.object({
  category: z.string().refine(isValidCategory, { message: 'Catégorie invalide.' }),
  program_context: z.string().max(500).optional(),
  locale: z.enum(['fr', 'en']).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour demander des suggestions.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`affirm:suggest:${user.id}:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu as déjà demandé beaucoup de suggestions — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = SuggestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await suggestAffirmations({
    category: parsed.data.category as Parameters<typeof suggestAffirmations>[0]['category'],
    programContext: parsed.data.program_context,
    locale: parsed.data.locale,
  })

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, suggestions: result.suggestions })
}

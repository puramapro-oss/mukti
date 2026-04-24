// MUKTI G8.2 — NAMA-Aidant chat (Claude Sonnet 4.6)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'
import { getNamaAidantSystemPrompt } from '@/lib/accompagnants'

export const runtime = 'nodejs'
export const maxDuration = 30

const BodySchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`nama-aidant:${profileId}`, 20, 300)
  if (!rl.ok) return NextResponse.json({ error: 'Pose-toi un instant. Réessaie dans quelques minutes.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Conversation invalide.' }, { status: 400 })
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL_MAIN || 'claude-sonnet-4-6'
  if (!apiKey) {
    return NextResponse.json({
      answer: "Je suis là. Ma connexion reprend souffle, réessaie dans un instant.",
    })
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: getNamaAidantSystemPrompt(),
        messages: parsed.data.history.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })
    if (!res.ok) {
      return NextResponse.json({
        answer: "Une brève respiration. Je suis de nouveau là dans un instant.",
      })
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    const block = (data.content ?? []).find(c => c.type === 'text')
    const answer = block?.text?.trim() ?? 'Je suis avec toi.'
    return NextResponse.json({ answer })
  } catch {
    return NextResponse.json({
      answer: 'Le réseau reprend son chemin. On réessaie dans un souffle.',
    })
  }
}

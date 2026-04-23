// POST /api/streak/relapse
// Rechute sans jugement. Trigger DB ferme le streak et ouvre un nouveau j0.
// Message bienveillant généré par Haiku en post-processing (best-effort, non bloquant).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { recordRelapse } from '@/lib/streaks'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { getAddictionMeta } from '@/lib/addictions'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import type { AddictionId } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 25

const BodySchema = z.object({
  addiction_id: z.string().uuid(),
  trigger_note: z.string().trim().max(500).optional(),
  mood_before: z.number().int().min(1).max(10).optional(),
  context_tags: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
})

function getHaikuModel(): string {
  return process.env.ANTHROPIC_MODEL_FAST || 'claude-haiku-4-5-20251001'
}

async function buildBenevolentInsight(params: {
  type: AddictionId
  trigger_note?: string
  mood_before?: number
  streak_days_lost: number
}): Promise<{ insight: string | null; model: string | null }> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return { insight: null, model: null }
    const meta = getAddictionMeta(params.type)
    const label = meta?.name ?? params.type

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const model = getHaikuModel()
    const msg = await client.messages.create({
      model,
      max_tokens: 400,
      system:
        'Tu es un accompagnant bienveillant pour la libération des addictions. ZÉRO jugement. ZÉRO culpabilité. TUTOIEMENT. FR. Jamais "guérit/traite/soigne". Toujours "libération/apaisement". Réponds en 2 à 4 phrases douces, courtes, qui honorent le fait d\'avoir cliqué. Termine par une micro-action concrète réalisable tout de suite (pas "médite 20min"). AUCUN texte hors du message.',
      messages: [
        {
          role: 'user',
          content: `Rechute ${label}. ${params.streak_days_lost > 0 ? `Série perdue : ${params.streak_days_lost} jours.` : 'Pas de série en cours.'}${params.trigger_note ? ` Contexte : ${params.trigger_note}.` : ''}${params.mood_before ? ` Humeur avant rechute : ${params.mood_before}/10.` : ''}`,
        },
      ],
    })

    const block = msg.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') return { insight: null, model }
    return { insight: block.text.trim(), model }
  } catch {
    return { insight: null, model: null }
  }
}

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const ip = getClientIp(req)
  // Rechute = pas de rate-limit strict (sans jugement) — juste anti-spam basique
  const rl = rateLimit(`streak:relapse:${ip}:${user.id}`, 20, 3600)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Un instant — réessaie dans quelques secondes.' }, { status: 429 })
  }

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 },
    )
  }

  const { data: addiction } = await sb
    .from('addictions')
    .select('id, type')
    .eq('id', parsed.data.addiction_id)
    .maybeSingle()

  if (!addiction) return NextResponse.json({ error: 'Addiction introuvable.' }, { status: 404 })

  const result = await recordRelapse({
    addictionId: parsed.data.addiction_id,
    trigger_note: parsed.data.trigger_note,
    mood_before: parsed.data.mood_before,
    context_tags: parsed.data.context_tags,
  })

  if (!result.relapse) return NextResponse.json({ error: result.error }, { status: 500 })

  const { insight, model } = await buildBenevolentInsight({
    type: addiction.type as AddictionId,
    trigger_note: parsed.data.trigger_note,
    mood_before: parsed.data.mood_before,
    streak_days_lost: result.relapse.streak_reset_from_days,
  })

  if (insight && model) {
    const admin = createServiceClient()
    await admin
      .from('relapses')
      .update({ generated_insight: insight, insight_model: model })
      .eq('id', result.relapse.id)
  }

  return NextResponse.json({
    ok: true,
    relapse: {
      ...result.relapse,
      generated_insight: insight,
      insight_model: model,
    },
    message:
      insight ??
      'Le simple fait d\'être honnête avec toi est déjà un pas. Un nouveau départ commence maintenant. 🌱',
  })
}

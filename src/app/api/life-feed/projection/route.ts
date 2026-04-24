// MUKTI G8.3 — Projection 5/10/20 ans via Claude Sonnet (summary) + calcul stats
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'
import { getMyStats, computeProjectionFromStats, saveProjection } from '@/lib/life-feed'
import { PROJECTION_HORIZONS, type ProjectionHorizon } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 30

const BodySchema = z.object({
  horizon_years: z.union([z.literal(5), z.literal(10), z.literal(20)]),
})

async function generateSummaries(horizon: ProjectionHorizon, impact: {
  rituals_count: number
  missions_count: number
  co2_saved_kg: number
  lives_touched_estimate: number
  donations_cents: number
  personal_growth_level: string
}): Promise<{ summary_fr: string; summary_en: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL_MAIN || 'claude-sonnet-4-6'
  const fallbackFr = `Dans ${horizon} ans, ton chemin aura accueilli environ ${impact.rituals_count} rituels, ${impact.missions_count} missions, et touché autour de ${impact.lives_touched_estimate} vies. Pas à pas, tu incarnes une évolution silencieuse et solide.`
  const fallbackEn = `In ${horizon} years, your path will have welcomed about ${impact.rituals_count} rituals, ${impact.missions_count} missions, and touched around ${impact.lives_touched_estimate} lives. Step by step, you embody a silent, solid evolution.`
  if (!apiKey) return { summary_fr: fallbackFr, summary_en: fallbackEn }
  try {
    const prompt = `Tu es MUKTI. Écris 2 paragraphes courts (FR + EN), motivants mais ancrés, décrivant l'impact projeté à ${horizon} ans :
- ${impact.rituals_count} rituels
- ${impact.missions_count} missions accomplies
- ${impact.co2_saved_kg} kg CO₂ évité
- ${impact.lives_touched_estimate} vies touchées estimées
- ${(impact.donations_cents / 100).toFixed(0)}€ redirigés
- Niveau : ${impact.personal_growth_level}

Réponds STRICTEMENT en JSON : {"summary_fr":"…", "summary_en":"…"}. Max 4 phrases chacun. Tutoyer en FR. Aucune garantie de guérison ou richesse.`
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { summary_fr: fallbackFr, summary_en: fallbackEn }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    const text = (data.content ?? []).find(c => c.type === 'text')?.text?.trim() ?? ''
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { summary_fr?: string; summary_en?: string }
    return {
      summary_fr: parsed.summary_fr ?? fallbackFr,
      summary_en: parsed.summary_en ?? fallbackEn,
    }
  } catch {
    return { summary_fr: fallbackFr, summary_en: fallbackEn }
  }
}

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`life-projection:${profileId}`, 10, 600)
  if (!rl.ok) return NextResponse.json({ error: 'Attends un peu avant une nouvelle projection.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Horizon invalide. Choisis 5, 10 ou 20.' }, { status: 400 })
  }
  const horizon = parsed.data.horizon_years as ProjectionHorizon
  if (!PROJECTION_HORIZONS.includes(horizon)) {
    return NextResponse.json({ error: 'Horizon non supporté.' }, { status: 400 })
  }
  const stats = await getMyStats()
  if (stats.total_entries === 0) {
    return NextResponse.json(
      { error: 'Commence par vivre quelques moments MUKTI avant de projeter.' },
      { status: 400 },
    )
  }
  const impact = await computeProjectionFromStats(stats, horizon)
  const { summary_fr, summary_en } = await generateSummaries(horizon, impact)
  await saveProjection(horizon, impact, summary_fr, summary_en)
  return NextResponse.json({
    horizon_years: horizon,
    projected_impact: impact,
    summary_fr,
    summary_en,
    generated_at: new Date().toISOString(),
  })
}

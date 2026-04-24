// MUKTI G8.4 — Join rituel hebdo (upsert participation + agrégats)
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { joinRituelCurrentWeek } from '@/lib/rituel-hebdo'
import { recordLifeFeedEntry } from '@/lib/life-feed'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const BodySchema = z.object({
  minutes_practiced: z.number().int().min(1).max(180),
  intention_text: z.string().max(500).optional(),
  shared: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`rituel-join:${profileId}`, 5, 300)
  if (!rl.ok) return NextResponse.json({ error: 'Attends un moment avant un nouveau dépôt.' }, { status: 429 })
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Durée invalide.' }, { status: 400 })
  }
  const result = await joinRituelCurrentWeek(parsed.data)
  if (!result.ok || !result.week_iso) {
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  }
  // Inscrit dans le Fil de Vie
  await recordLifeFeedEntry({
    userId: profileId,
    kind: 'rituel_hebdo_participated',
    label_fr: `Rituel hebdomadaire · semaine ${result.week_iso} · ${parsed.data.minutes_practiced} min`,
    label_en: `Weekly ritual · week ${result.week_iso} · ${parsed.data.minutes_practiced} min`,
    source_table: 'rituel_hebdo_participations',
    payload: {
      week_iso: result.week_iso,
      minutes: parsed.data.minutes_practiced,
      shared: parsed.data.shared,
    },
  })
  return NextResponse.json({ ok: true, week_iso: result.week_iso })
}

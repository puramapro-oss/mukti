// POST /api/mental-journal/analyze — Whisper + Claude analyse audio journal.
// Rate 10/h (coût Whisper ~0.006$/min + Claude).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { analyzeAudioJournal } from '@/lib/mental-journal'
import { MENTAL_JOURNAL_MAX_AUDIO_SEC } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 90

const AnalyzeSchema = z.object({
  audio_base64: z.string().min(700), // ≈ 512 bytes binary min
  lang_hint: z.string().min(2).max(8).optional(),
  declared_duration_sec: z.number().int().min(1).max(MENTAL_JOURNAL_MAX_AUDIO_SEC).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour analyser ton journal.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`journal:analyze:${user.id}:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = AnalyzeSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await analyzeAudioJournal({
    audio_base64: parsed.data.audio_base64,
    lang_hint: parsed.data.lang_hint,
    declared_duration_sec: parsed.data.declared_duration_sec,
  })
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ entry: result.entry }, { status: 201 })
}

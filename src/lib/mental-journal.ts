// MUKTI — G6 Mode 20 Journal Mental Automatique
// Whisper (OpenAI) transcription + Claude Sonnet analyse mood + prédiction relapse.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { askClaudeJSON } from './claude'
import {
  MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD,
  MENTAL_JOURNAL_MAX_AUDIO_SEC,
} from './constants'

export interface MentalJournalEntry {
  id: string
  user_id: string
  audio_duration_sec: number | null
  transcript: string | null
  transcript_lang: string | null
  mood_analysis: Record<string, unknown>
  mood_score: number | null
  energy_score: number | null
  anxiety_score: number | null
  relapse_risk: number | null
  insights_fr: string[] | null
  insights_en: string[] | null
  claude_model: string | null
  flagged_for_review: boolean
  alerted_at: string | null
  created_at: string
}

export interface MoodAnalysis {
  mood_score: number // 1-10
  energy_score: number // 1-10
  anxiety_score: number // 1-10
  relapse_risk: number // 0-1
  insights_fr: string[]
  insights_en: string[]
  themes: string[]
}

async function transcribeAudio(audioBuffer: Buffer, lang: string = 'fr'): Promise<{
  text: string
  detected_lang: string
  duration_sec: number | null
} | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'audio.webm')
    form.append('model', 'whisper-1')
    form.append('language', lang)
    form.append('response_format', 'verbose_json')
    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    })
    if (!resp.ok) return null
    const json = (await resp.json()) as { text: string; language?: string; duration?: number }
    return {
      text: (json.text ?? '').trim(),
      detected_lang: json.language ?? lang,
      duration_sec: json.duration != null ? Math.round(json.duration) : null,
    }
  } catch {
    return null
  }
}

async function analyzeMood(transcript: string, langHint: string = 'fr'): Promise<MoodAnalysis | null> {
  if (transcript.trim().length < 5) return null
  const prompt = `Tu es MUKTI, assistant empathique. Analyse la transcription de ce journal audio quotidien pour détecter l'état mental et le risque de rechute.

TRANSCRIPTION (${langHint}) :
"""
${transcript.slice(0, 3000)}
"""

Réponds UNIQUEMENT en JSON avec ce schéma exact :
{
  "mood_score": 1-10 (1=très bas, 10=très haut),
  "energy_score": 1-10 (1=épuisé, 10=plein d'énergie),
  "anxiety_score": 1-10 (1=calme, 10=anxiété extrême),
  "relapse_risk": 0.0-1.0 (probabilité de rechute dans les 24h),
  "insights_fr": [3 observations courtes et bienveillantes, max 120c chacune],
  "insights_en": [3 short kind observations, max 120c each],
  "themes": [3-5 mots-clés du contenu : "solitude", "colère", "fierté", "fatigue", etc.]
}

Règles :
- Ton bienveillant, non jugeant
- relapse_risk élevé (>0.6) si : mention explicite d'envie, isolement social, stress aigu, langage négatif intense
- JAMAIS diagnostic médical
- insights en "tu" tutoiement chaleureux`

  return await askClaudeJSON<MoodAnalysis>({
    prompt,
    model: process.env.ANTHROPIC_MODEL_MAIN || 'claude-sonnet-4-6',
    maxTokens: 2048,
  })
}

export interface AnalyzeInput {
  audio_base64: string
  lang_hint?: string
  declared_duration_sec?: number
}

/** Full pipeline : base64 audio → Whisper → Claude → persist + alert if risk high. */
export async function analyzeAudioJournal(input: AnalyzeInput): Promise<{
  entry: MentalJournalEntry | null
  error: string | null
}> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { entry: null, error: 'Profil introuvable — reconnecte-toi.' }

  if (input.declared_duration_sec != null && input.declared_duration_sec > MENTAL_JOURNAL_MAX_AUDIO_SEC) {
    return { entry: null, error: `Audio trop long (max ${MENTAL_JOURNAL_MAX_AUDIO_SEC}s).` }
  }

  let audioBuffer: Buffer
  try {
    const b64 = input.audio_base64.replace(/^data:audio\/\w+;base64,/, '')
    audioBuffer = Buffer.from(b64, 'base64')
  } catch {
    return { entry: null, error: 'Audio invalide.' }
  }
  if (audioBuffer.byteLength < 512) {
    return { entry: null, error: 'Audio trop court.' }
  }
  if (audioBuffer.byteLength > 6 * 1024 * 1024) {
    return { entry: null, error: 'Audio trop volumineux (max 6 Mo).' }
  }

  const tr = await transcribeAudio(audioBuffer, input.lang_hint ?? 'fr')
  if (!tr || !tr.text) {
    return { entry: null, error: 'Transcription impossible. Réessaie dans un instant.' }
  }

  const mood = await analyzeMood(tr.text, tr.detected_lang)
  if (!mood) {
    return { entry: null, error: 'Analyse impossible. Réessaie dans un instant.' }
  }

  const relapseRisk = Math.max(0, Math.min(1, mood.relapse_risk))
  const flagged = relapseRisk > MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD

  const sb = createServiceClient()
  const { data, error } = await sb
    .schema('mukti')
    .from('mental_journal_entries')
    .insert({
      user_id: profileId,
      audio_duration_sec: tr.duration_sec ?? input.declared_duration_sec ?? null,
      transcript: tr.text.slice(0, 8000),
      transcript_lang: tr.detected_lang,
      mood_analysis: mood as unknown as Record<string, unknown>,
      mood_score: mood.mood_score,
      energy_score: mood.energy_score,
      anxiety_score: mood.anxiety_score,
      relapse_risk: relapseRisk,
      insights_fr: mood.insights_fr.slice(0, 5),
      insights_en: mood.insights_en.slice(0, 5),
      claude_model: process.env.ANTHROPIC_MODEL_MAIN || 'claude-sonnet-4-6',
      flagged_for_review: flagged,
    })
    .select('*')
    .single()
  if (error || !data) {
    return { entry: null, error: "Impossible d'enregistrer l'entrée." }
  }
  return { entry: data as MentalJournalEntry, error: null }
}

export async function listEntries(limit: number = 7): Promise<MentalJournalEntry[]> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return []
  const sb = createServiceClient()
  const { data } = await sb
    .schema('mukti')
    .from('mental_journal_entries')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(30, limit)))
  return (data ?? []) as MentalJournalEntry[]
}

async function resolveProfileId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

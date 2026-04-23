// MUKTI — G5.7 Exorcisme de l'Addiction (Mode 10) — server helpers
// Ne PAS importer depuis un Client Component (utilise createServerSupabaseClient + askClaudeJSON).
// Clients → importer depuis './exorcisme-utils'.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { askClaudeJSON } from './claude'
import {
  EXORCISME_MAX_TEXT_LENGTH,
  pickFallbackAffirmation,
  sanitizePossessionText,
  type ExorcismeOutcome,
  type ExorcismePhaseName,
} from './exorcisme-utils'

export {
  EXORCISME_PHASES,
  EXORCISME_MIN_TEXT_LENGTH,
  EXORCISME_MAX_TEXT_LENGTH,
  EXORCISME_SHATTER_TAPS,
  EXORCISME_FALLBACK_AFFIRMATIONS_FR,
  pickFallbackAffirmation,
  sanitizePossessionText,
} from './exorcisme-utils'
export type {
  ExorcismeOutcome,
  ExorcismePhaseName,
  ExorcismePhase,
} from './exorcisme-utils'

export interface ExorcismeSensorData {
  possession_text?: string
  affirmation_fr?: string
  affirmation_en?: string
  affirmation_source?: 'haiku' | 'fallback'
  taps_destruction?: number
  phases_ms?: Partial<Record<ExorcismePhaseName, number>>
  sealed?: boolean
}

export interface ExorcismeStats {
  total: number
  today_count: number
  sealed_count: number
  recent: Array<{
    id: string
    started_at: string
    completed_at: string | null
    duration_sec: number | null
    outcome: ExorcismeOutcome | null
    possession_text: string | null
    affirmation_fr: string | null
    sealed: boolean
  }>
}

/** Démarre une séance : insère mode_sessions row, renvoie session_id. */
export async function startExorcismeSession(input: {
  possession_text: string
}): Promise<{ session_id: string; possession_text: string } | { error: string }> {
  const text = sanitizePossessionText(input.possession_text)
  if (text.length === 0) return { error: 'Nomme ce qui te possède (au moins un mot).' }
  if (text.length > EXORCISME_MAX_TEXT_LENGTH) {
    return { error: 'Reste concis·e (80 caractères max).' }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Connexion requise.' }

  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { error: 'Profil introuvable.' }

  const service = createServiceClient()
  const { data, error } = await service
    .schema('mukti')
    .from('mode_sessions')
    .insert({
      user_id: profileId,
      mode: 'exorcisme',
      started_at: new Date().toISOString(),
      sensor_data: { possession_text: text } satisfies ExorcismeSensorData,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'Impossible de démarrer la séance — réessaie.' }
  }
  return { session_id: (data as { id: string }).id, possession_text: text }
}

/**
 * Génère une affirmation contextuelle de remplacement via Claude Haiku 4.5 (JSON-mode).
 * Fallback gracieux sur EXORCISME_FALLBACK_AFFIRMATIONS_FR si Haiku échoue.
 * Persiste le résultat dans sensor_data de la session.
 */
export async function generateReprogAffirmation(input: {
  session_id: string
  possession_text: string
}): Promise<
  | { affirmation_fr: string; affirmation_en: string; source: 'haiku' | 'fallback' }
  | { error: string }
> {
  const text = sanitizePossessionText(input.possession_text)
  if (!text || !input.session_id) return { error: 'Données manquantes.' }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Connexion requise.' }

  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { error: 'Profil introuvable.' }

  const service = createServiceClient()

  // Ownership check
  const { data: existing } = await service
    .schema('mukti')
    .from('mode_sessions')
    .select('id, sensor_data')
    .eq('id', input.session_id)
    .eq('user_id', profileId)
    .eq('mode', 'exorcisme')
    .maybeSingle()

  if (!existing) return { error: 'Séance introuvable.' }
  const existingRow = existing as { id: string; sensor_data: ExorcismeSensorData | null }

  const model = process.env.ANTHROPIC_MODEL_FAST || 'claude-haiku-4-5-20251001'

  const prompt = `L'utilisateur·rice nomme ce qui le/la possède : « ${text} »

Génère UNE affirmation de remplacement courte, en français puis anglais. Elle doit :
- Tutoyer (FR) / "you" (EN)
- Être précise et incarnée par rapport à ce qui est nommé (pas générique)
- 40 à 120 caractères MAX par langue
- Reposer sur la force propre de la personne (pas promesse, pas religieux, pas ésotérique)
- Pas : "Tu vas guérir", "Je te promets", "Nous sommes Un", "Dieu", "l'Univers"
- Préférer le présent ("Je choisis", "Je reprends", "Je ressens")

Renvoie UNIQUEMENT ce JSON :
{"fr":"...","en":"..."}`

  let affirmation_fr = ''
  let affirmation_en = ''
  let source: 'haiku' | 'fallback' = 'haiku'

  const haiku = await askClaudeJSON<{ fr: string; en: string }>({
    prompt,
    model,
    maxTokens: 400,
    system:
      'Tu es un guide de libération MUKTI. Tu réponds UNIQUEMENT en JSON valide, sans markdown ni prose autour. Tutoiement FR, non religieux, non promesse, court.',
  }).catch(() => null)

  const frRaw = (haiku?.fr ?? '').trim()
  const enRaw = (haiku?.en ?? '').trim()

  if (frRaw.length >= 10 && frRaw.length <= 180 && enRaw.length >= 10 && enRaw.length <= 180) {
    affirmation_fr = frRaw
    affirmation_en = enRaw
  } else {
    affirmation_fr = pickFallbackAffirmation()
    affirmation_en = affirmation_fr // pas de traduction automatique — usage display FR-first
    source = 'fallback'
  }

  // Persiste dans sensor_data (merge)
  const mergedSensor: ExorcismeSensorData = {
    ...(existingRow.sensor_data ?? {}),
    affirmation_fr,
    affirmation_en,
    affirmation_source: source,
  }
  await service
    .schema('mukti')
    .from('mode_sessions')
    .update({ sensor_data: mergedSensor })
    .eq('id', input.session_id)
    .eq('user_id', profileId)

  return { affirmation_fr, affirmation_en, source }
}

/** Clôture la séance : UPDATE outcome + duration + taps + phases_ms + sealed. Idempotent. */
export async function completeExorcismeSession(input: {
  session_id: string
  outcome: ExorcismeOutcome
  duration_sec: number
  taps_destruction?: number
  phases_ms?: Partial<Record<ExorcismePhaseName, number>>
  sealed?: boolean
  affirmation_used?: string
}): Promise<{ ok: true; stats: ExorcismeStats } | { error: string }> {
  if (!input.session_id) return { error: 'Séance invalide.' }
  if (input.duration_sec < 0 || input.duration_sec > 60 * 15) {
    return { error: 'Durée incohérente.' }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Connexion requise.' }

  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { error: 'Profil introuvable.' }

  const service = createServiceClient()
  const { data: existing } = await service
    .schema('mukti')
    .from('mode_sessions')
    .select('id, completed_at, sensor_data')
    .eq('id', input.session_id)
    .eq('user_id', profileId)
    .eq('mode', 'exorcisme')
    .maybeSingle()

  if (!existing) return { error: 'Séance introuvable.' }
  const row = existing as {
    id: string
    completed_at: string | null
    sensor_data: ExorcismeSensorData | null
  }
  if (row.completed_at) {
    const stats = await computeExorcismeStats(profileId)
    return { ok: true, stats }
  }

  const mergedSensor: ExorcismeSensorData = {
    ...(row.sensor_data ?? {}),
    taps_destruction: Math.max(0, Math.min(99, Math.round(input.taps_destruction ?? 0))),
    phases_ms: input.phases_ms ?? {},
    sealed: Boolean(input.sealed),
    ...(input.affirmation_used ? { affirmation_fr: input.affirmation_used } : {}),
  }

  const { error: updErr } = await service
    .schema('mukti')
    .from('mode_sessions')
    .update({
      completed_at: new Date().toISOString(),
      duration_sec: Math.max(0, Math.round(input.duration_sec)),
      outcome: input.outcome,
      sensor_data: mergedSensor,
    })
    .eq('id', input.session_id)
    .eq('user_id', profileId)

  if (updErr) return { error: 'Impossible d\'enregistrer la fin — réessaie.' }

  const stats = await computeExorcismeStats(profileId)
  return { ok: true, stats }
}

/** Stats on-the-fly : total, today, sealed, 10 récents. */
export async function computeExorcismeStats(profileId: string): Promise<ExorcismeStats> {
  const service = createServiceClient()
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await service
    .schema('mukti')
    .from('mode_sessions')
    .select('id, started_at, completed_at, duration_sec, outcome, sensor_data')
    .eq('user_id', profileId)
    .eq('mode', 'exorcisme')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(200)

  const rows = (data ?? []) as Array<{
    id: string
    started_at: string
    completed_at: string | null
    duration_sec: number | null
    outcome: ExorcismeOutcome | null
    sensor_data: ExorcismeSensorData | null
  }>

  const completed = rows.filter(r => r.outcome === 'completed')
  const todayUtc = new Date().toISOString().slice(0, 10)
  const today_count = completed.filter(r => r.started_at.slice(0, 10) === todayUtc).length
  const sealed_count = completed.filter(r => r.sensor_data?.sealed === true).length

  const recent = rows.slice(0, 10).map(r => ({
    id: r.id,
    started_at: r.started_at,
    completed_at: r.completed_at,
    duration_sec: r.duration_sec,
    outcome: r.outcome,
    possession_text: r.sensor_data?.possession_text ?? null,
    affirmation_fr: r.sensor_data?.affirmation_fr ?? null,
    sealed: Boolean(r.sensor_data?.sealed),
  }))

  return { total: completed.length, today_count, sealed_count, recent }
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

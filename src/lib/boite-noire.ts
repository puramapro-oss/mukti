// MUKTI — Boîte Noire (G5 Mode 13)
// Capture des déclencheurs d'addiction + détection de pattern IA (Haiku 4.5).
// RGPD : jamais de GPS brut, seulement 6 location presets.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { askClaudeJSON } from './claude'
import {
  BOITE_NOIRE_LOCATIONS,
  BOITE_NOIRE_WHO,
  type BoiteNoireLocation,
  type BoiteNoireWho,
} from './constants'

export interface BoiteNoireEntry {
  id: string
  user_id: string
  addiction_id: string
  occurred_at: string
  location_hint: BoiteNoireLocation | null
  who_context: BoiteNoireWho | null
  what_trigger: string
  emotion: string | null
  intensity: number // 1-10
  resisted: boolean
  created_at: string
}

export interface CaptureInput {
  addiction_id: string
  location_hint?: BoiteNoireLocation | null
  who_context?: BoiteNoireWho | null
  what_trigger: string
  emotion?: string | null
  intensity: number
  resisted?: boolean
}

export interface PatternInsight {
  top_hour_window: string | null  // ex "18:00–22:00"
  top_location: BoiteNoireLocation | null
  top_who: BoiteNoireWho | null
  top_emotion: string | null
  resist_rate: number // 0-1
  total_entries: number
  narrative_fr: string
  narrative_en: string
}

export function isValidLocation(v: string): v is BoiteNoireLocation {
  return (BOITE_NOIRE_LOCATIONS as readonly { id: string }[]).some(l => l.id === v)
}
export function isValidWho(v: string): v is BoiteNoireWho {
  return (BOITE_NOIRE_WHO as readonly { id: string }[]).some(w => w.id === v)
}

/**
 * Capture une entrée dans la boîte noire (déclencheur).
 * Valide ownership addiction_id → user.
 */
export async function captureEntry(input: CaptureInput): Promise<{
  entry: BoiteNoireEntry | null
  error: string | null
}> {
  const what = input.what_trigger?.trim() ?? ''
  if (what.length < 2 || what.length > 500) {
    return { entry: null, error: 'Décris le déclencheur en 2 à 500 caractères.' }
  }
  if (!Number.isInteger(input.intensity) || input.intensity < 1 || input.intensity > 10) {
    return { entry: null, error: 'L\'intensité doit être entre 1 et 10.' }
  }
  if (input.location_hint !== null && input.location_hint !== undefined && !isValidLocation(input.location_hint)) {
    return { entry: null, error: 'Lieu invalide — choisis parmi les options proposées.' }
  }
  if (input.who_context !== null && input.who_context !== undefined && !isValidWho(input.who_context)) {
    return { entry: null, error: 'Contexte social invalide.' }
  }

  const supabase = await createServerSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { entry: null, error: 'Non authentifié — reconnecte-toi.' }
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { entry: null, error: 'Profil introuvable.' }

  const sb = createServiceClient()
  const { data: addiction } = await sb
    .schema('mukti')
    .from('addictions')
    .select('id, user_id')
    .eq('id', input.addiction_id)
    .eq('user_id', profileId)
    .maybeSingle()
  if (!addiction) {
    return { entry: null, error: 'Addiction introuvable ou non autorisée.' }
  }

  const { data, error } = await sb
    .schema('mukti')
    .from('boite_noire_entries')
    .insert({
      user_id: profileId,
      addiction_id: input.addiction_id,
      location_hint: input.location_hint ?? null,
      who_context: input.who_context ?? null,
      what_trigger: what,
      emotion: input.emotion?.trim().slice(0, 30) || null,
      intensity: input.intensity,
      resisted: input.resisted ?? false,
    })
    .select(
      'id, user_id, addiction_id, occurred_at, location_hint, who_context, what_trigger, emotion, intensity, resisted, created_at'
    )
    .single()
  if (error || !data) {
    return { entry: null, error: 'Impossible d\'enregistrer l\'entrée.' }
  }
  return { entry: data as BoiteNoireEntry, error: null }
}

/** Liste les N dernières entrées d'une addiction pour l'utilisateur courant. */
export async function listEntries(opts: {
  addictionId: string
  limit?: number
}): Promise<{ entries: BoiteNoireEntry[]; error: string | null }> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50))
  const supabase = await createServerSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { entries: [], error: 'Non authentifié — reconnecte-toi.' }
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { entries: [], error: 'Profil introuvable.' }

  const sb = createServiceClient()
  const { data, error } = await sb
    .schema('mukti')
    .from('boite_noire_entries')
    .select(
      'id, user_id, addiction_id, occurred_at, location_hint, who_context, what_trigger, emotion, intensity, resisted, created_at'
    )
    .eq('user_id', profileId)
    .eq('addiction_id', opts.addictionId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) return { entries: [], error: error.message }
  return { entries: (data as BoiteNoireEntry[]) ?? [], error: null }
}

/**
 * Agrégats statistiques sur les 90 derniers jours (groupBy hour/location/who/emotion).
 * Pure calcul — pas d'appel IA.
 */
export function computeAggregates(entries: BoiteNoireEntry[]): {
  top_hour_window: string | null
  top_location: BoiteNoireLocation | null
  top_who: BoiteNoireWho | null
  top_emotion: string | null
  resist_rate: number
  total_entries: number
} {
  if (entries.length === 0) {
    return {
      top_hour_window: null,
      top_location: null,
      top_who: null,
      top_emotion: null,
      resist_rate: 0,
      total_entries: 0,
    }
  }

  // Bucket par fenêtres de 4h : [0-4], [4-8], [8-12], [12-16], [16-20], [20-24]
  const hourBuckets = new Map<string, number>()
  const locCounts = new Map<string, number>()
  const whoCounts = new Map<string, number>()
  const emoCounts = new Map<string, number>()
  let resisted = 0
  for (const e of entries) {
    const d = new Date(e.occurred_at)
    const h = d.getUTCHours()
    const bucket = `${String(Math.floor(h / 4) * 4).padStart(2, '0')}:00–${String(Math.floor(h / 4) * 4 + 4).padStart(2, '0')}:00`
    hourBuckets.set(bucket, (hourBuckets.get(bucket) ?? 0) + 1)
    if (e.location_hint) locCounts.set(e.location_hint, (locCounts.get(e.location_hint) ?? 0) + 1)
    if (e.who_context) whoCounts.set(e.who_context, (whoCounts.get(e.who_context) ?? 0) + 1)
    if (e.emotion) emoCounts.set(e.emotion.toLowerCase(), (emoCounts.get(e.emotion.toLowerCase()) ?? 0) + 1)
    if (e.resisted) resisted++
  }
  return {
    top_hour_window: topKey(hourBuckets),
    top_location: (topKey(locCounts) as BoiteNoireLocation | null) ?? null,
    top_who: (topKey(whoCounts) as BoiteNoireWho | null) ?? null,
    top_emotion: topKey(emoCounts),
    resist_rate: Math.round((resisted / entries.length) * 100) / 100,
    total_entries: entries.length,
  }
}

function topKey(m: Map<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [k, v] of m.entries()) {
    if (v > bestCount) {
      best = k
      bestCount = v
    }
  }
  return best
}

/**
 * Détection de pattern IA — Haiku 4.5 analyse les 20 dernières entries
 * et génère un narratif bienveillant non-jugeant.
 * Déclenché manuellement ou automatiquement si entries >= 10.
 */
export async function detectPatterns(opts: {
  addictionId: string
}): Promise<{ insight: PatternInsight | null; error: string | null }> {
  const { entries, error } = await listEntries({ addictionId: opts.addictionId, limit: 20 })
  if (error) return { insight: null, error }
  if (entries.length < 5) {
    return {
      insight: null,
      error: 'Il te faut au moins 5 entrées pour révéler un schéma — continue de capturer tes déclencheurs.',
    }
  }

  const agg = computeAggregates(entries)
  const sample = entries
    .slice(0, 20)
    .map(e => ({
      when: e.occurred_at,
      where: e.location_hint ?? 'inconnu',
      who: e.who_context ?? 'inconnu',
      trigger: e.what_trigger.slice(0, 120),
      emotion: e.emotion ?? null,
      intensity: e.intensity,
      resisted: e.resisted,
    }))

  const prompt = `Tu es MUKTI, accompagnant bienveillant non-jugeant. Analyse ces ${entries.length} déclencheurs d'addiction capturés par un utilisateur et génère un narratif court qui révèle son schéma sans juger.

Données agrégées :
- fenêtre horaire la plus fréquente : ${agg.top_hour_window ?? 'aucune dominante'}
- lieu dominant : ${agg.top_location ?? 'aucun'}
- contexte social dominant : ${agg.top_who ?? 'aucun'}
- émotion dominante : ${agg.top_emotion ?? 'aucune'}
- taux de résistance : ${(agg.resist_rate * 100).toFixed(0)}%

Échantillon d'entrées :
${JSON.stringify(sample, null, 2)}

Contraintes :
- Ton : bienveillant, factuel, révélateur, JAMAIS moralisateur ni médical
- Tutoiement en français ("tu"), "you" en anglais
- 2-4 phrases max par langue
- Finis par une observation qui ouvre un choix (pas une prescription)
- JAMAIS "tu dois", "tu devrais", "il faut" — plutôt "tu remarques", "tu constates", "tu pourrais explorer"

Retourne STRICTEMENT ce JSON :
{
  "narrative_fr": "...",
  "narrative_en": "..."
}`

  const raw = await askClaudeJSON<{ narrative_fr: string; narrative_en: string }>({
    prompt,
    model: process.env.ANTHROPIC_MODEL_FAST,
    maxTokens: 1024,
  })
  if (!raw || typeof raw.narrative_fr !== 'string' || typeof raw.narrative_en !== 'string') {
    return {
      insight: null,
      error: 'La détection de schéma est momentanément indisponible — réessaie.',
    }
  }

  return {
    insight: {
      ...agg,
      narrative_fr: raw.narrative_fr.trim().slice(0, 600),
      narrative_en: raw.narrative_en.trim().slice(0, 600),
    },
    error: null,
  }
}

// Helper : résout profiles.id via auth_user_id
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

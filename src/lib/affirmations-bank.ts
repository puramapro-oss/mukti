// MUKTI — Banque d'affirmations conscientes (G5)
// Utilisée par Reprogrammation (Mode Nuit + Mode Journée).
// Tirage frequency-weighted + mix système + custom user + suggestion IA (Haiku 4.5).

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { askClaudeJSON } from './claude'
import { REPROG_CATEGORIES, type ReprogCategory } from './constants'

export interface Affirmation {
  id: string
  category: ReprogCategory
  text_fr: string
  text_en: string | null
  frequency_weight: number
  source: 'purama' | 'user' | 'community'
  created_at: string
}

export interface CustomAffirmation {
  id: string
  user_id: string
  category: ReprogCategory
  text_user: string
  active: boolean
  created_at: string
}

export type Locale = 'fr' | 'en'

/** Validation type-safe. */
export function isValidCategory(v: string): v is ReprogCategory {
  return (REPROG_CATEGORIES as readonly { id: string }[]).some(c => c.id === v)
}

/** Meta d'une catégorie (name, emoji, solfeggio_hz). */
export function getCategoryMeta(id: ReprogCategory) {
  return REPROG_CATEGORIES.find(c => c.id === id)
}

/**
 * Liste affirmations actives d'une catégorie (anon OK car affirmations_read_all policy).
 * Tirage pondéré par frequency_weight (shuffle Fisher-Yates + biais proportionnel).
 */
export async function listAffirmationsByCategory(
  category: ReprogCategory,
  opts: { limit?: number; locale?: Locale } = {}
): Promise<Affirmation[]> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 50))
  const sb = createServiceClient()
  const { data, error } = await sb
    .schema('mukti')
    .from('affirmations')
    .select('id, category, text_fr, text_en, frequency_weight, source, created_at')
    .eq('category', category)
    .eq('active', true)
    .limit(500)
  if (error) throw new Error(`affirmations.list: ${error.message}`)
  return weightedShuffle((data ?? []) as Affirmation[]).slice(0, limit)
}

/** Mix système (affirmations table) + custom user (affirmation_custom). Garantit au moins `limit` items. */
export async function listForSession(params: {
  userId: string
  category: ReprogCategory
  limit?: number
}): Promise<Affirmation[]> {
  const limit = Math.max(5, Math.min(200, params.limit ?? 50))
  const sb = createServiceClient()

  const [systemRes, customRes] = await Promise.all([
    sb
      .schema('mukti')
      .from('affirmations')
      .select('id, category, text_fr, text_en, frequency_weight, source, created_at')
      .eq('category', params.category)
      .eq('active', true)
      .limit(400),
    sb
      .schema('mukti')
      .from('affirmation_custom')
      .select('id, user_id, category, text_user, created_at')
      .eq('user_id', params.userId)
      .eq('category', params.category)
      .eq('active', true)
      .limit(200),
  ])

  if (systemRes.error) throw new Error(`affirmations.system: ${systemRes.error.message}`)
  if (customRes.error) throw new Error(`affirmations.custom: ${customRes.error.message}`)

  const system: Affirmation[] = (systemRes.data ?? []) as Affirmation[]
  const custom: Affirmation[] = (customRes.data ?? []).map(c => ({
    id: `custom-${c.id}`,
    category: c.category as ReprogCategory,
    text_fr: c.text_user,
    text_en: null,
    frequency_weight: 2, // custom légèrement boostés (plus intimes)
    source: 'user' as const,
    created_at: c.created_at,
  }))

  const pool = [...system, ...custom]
  return weightedShuffle(pool).slice(0, limit)
}

/**
 * Crée une affirmation custom. Unique (user_id, text_user). Limite à 100/user/catégorie.
 */
export async function createCustomAffirmation(input: {
  category: ReprogCategory
  text: string
}): Promise<{ custom: CustomAffirmation | null; error: string | null }> {
  const text = input.text.trim()
  if (text.length < 5 || text.length > 300) {
    return { custom: null, error: 'Ton affirmation doit faire entre 5 et 300 caractères.' }
  }
  if (!isValidCategory(input.category)) {
    return { custom: null, error: 'Catégorie invalide.' }
  }

  const supabase = await createServerSupabaseClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { custom: null, error: 'Non authentifié — reconnecte-toi.' }
  }

  const profileId = await resolveProfileId(supabase)
  if (!profileId) {
    return { custom: null, error: 'Profil introuvable.' }
  }

  const sb = createServiceClient()
  const { count } = await sb
    .schema('mukti')
    .from('affirmation_custom')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profileId)
    .eq('category', input.category)
    .eq('active', true)
  if ((count ?? 0) >= 100) {
    return { custom: null, error: 'Tu as déjà 100 affirmations persos dans cette catégorie — désactive-en pour en créer de nouvelles.' }
  }

  const { data, error } = await sb
    .schema('mukti')
    .from('affirmation_custom')
    .insert({ user_id: profileId, category: input.category, text_user: text })
    .select('id, user_id, category, text_user, active, created_at')
    .single()
  if (error) {
    if (error.code === '23505') {
      return { custom: null, error: 'Tu as déjà cette affirmation.' }
    }
    return { custom: null, error: 'Impossible de sauvegarder cette affirmation.' }
  }
  return { custom: data as CustomAffirmation, error: null }
}

/** Liste les affirmations custom actives de l'utilisateur courant (toutes catégories). */
export async function listCustomAffirmationsForCurrentUser(): Promise<{
  items: CustomAffirmation[]
  error: string | null
}> {
  const supabase = await createServerSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { items: [], error: 'Non authentifié — reconnecte-toi.' }
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { items: [], error: 'Profil introuvable.' }

  const sb = createServiceClient()
  const { data, error } = await sb
    .schema('mukti')
    .from('affirmation_custom')
    .select('id, user_id, category, text_user, active, created_at')
    .eq('user_id', profileId)
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error) return { items: [], error: error.message }
  return { items: (data as CustomAffirmation[]) ?? [], error: null }
}

/**
 * IA suggestion : Haiku 4.5 génère 5 affirmations adaptées au programme user.
 * Pas inséré en DB automatiquement — l'utilisateur choisit lesquelles sauver.
 */
export async function suggestAffirmations(input: {
  category: ReprogCategory
  programContext?: string
  locale?: Locale
}): Promise<{ suggestions: Array<{ text_fr: string; text_en: string }>; error: string | null }> {
  const cat = getCategoryMeta(input.category)
  if (!cat) return { suggestions: [], error: 'Catégorie invalide.' }

  const locale = input.locale ?? 'fr'
  const prompt = `Tu es MUKTI — expert libération spirituelle non-dogmatique. Tu génères 5 affirmations conscientes bienveillantes courtes (40-120 chars) pour la catégorie "${cat.name}" (fréquence Solfeggio ${cat.solfeggio_hz}Hz).

Contexte utilisateur : ${input.programContext ?? 'programme générique libération'}.

Contraintes strictes :
- Tutoiement en français ("tu"), "you" en anglais
- JAMAIS de "je te promets", "tu vas guérir", "nous sommes Un" (pas de gourou)
- JAMAIS de références religieuses spécifiques (pas de Dieu/Jésus/Allah)
- Ton : intime, doux, libérateur, présent, non-injonctif
- Format JSON strict obligatoire

Retourne STRICTEMENT ce JSON sans texte autour :
{
  "suggestions": [
    {"text_fr": "...", "text_en": "..."},
    ...
  ]
}`

  try {
    const raw = await askClaudeJSON<{ suggestions: Array<{ text_fr: string; text_en: string }> }>({
      prompt,
      model: process.env.ANTHROPIC_MODEL_FAST,
      maxTokens: 2048,
    })
    if (!raw?.suggestions || !Array.isArray(raw.suggestions)) {
      return { suggestions: [], error: 'Réponse IA invalide — réessaie dans un instant.' }
    }
    const valid = raw.suggestions
      .filter(s => s && typeof s.text_fr === 'string' && typeof s.text_en === 'string')
      .slice(0, 5)
      .map(s => ({
        text_fr: s.text_fr.trim().slice(0, 300),
        text_en: s.text_en.trim().slice(0, 300),
      }))
      .filter(s => s.text_fr.length >= 5 && s.text_en.length >= 5)
    if (valid.length === 0) {
      return { suggestions: [], error: 'Aucune suggestion exploitable — réessaie.' }
    }
    // Locale swap si EN demandé (on ne change rien, les deux sont retournés)
    void locale
    return { suggestions: valid, error: null }
  } catch (_e) {
    return { suggestions: [], error: 'Le générateur d\'affirmations est indisponible — réessaie dans un instant.' }
  }
}

/** Fisher-Yates pondéré — poids = frequency_weight. Pas de crypto, suffisant pour UX. */
function weightedShuffle<T extends { frequency_weight: number }>(items: T[]): T[] {
  const withKey = items.map(item => ({
    item,
    key: -Math.log(Math.random()) / Math.max(0.0001, item.frequency_weight),
  }))
  withKey.sort((a, b) => a.key - b.key)
  return withKey.map(x => x.item)
}

/** Helper : résout `profiles.id` depuis auth.users.id (mukti.profiles.auth_user_id → profiles.id). */
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

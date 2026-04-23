// MUKTI — couche éveil spirituel
// Affirmations conscientes (jamais subliminales), événements de progression, helpers

import { createClient } from './supabase'
import { AWAKENING_LEVELS } from './constants'

export type AffirmationCategory =
  | 'abondance'
  | 'amour-soi'
  | 'amour'
  | 'confiance'
  | 'liberation-addictions'
  | 'guerison-emotionnelle'
  | 'sommeil-reparateur'
  | 'manifestation'
  | 'protection'
  | 'paix'
  | 'gratitude'
  | 'sagesse'

export interface Affirmation {
  id: string
  category: AffirmationCategory
  text_fr: string
  text_en: string | null
  text_es: string | null
  text_de: string | null
  text_pt: string | null
  text_ar: string | null
  text_zh: string | null
  text_ja: string | null
  voice_url: string | null
  frequency_weight: number
  source: 'purama' | 'user' | 'community'
  active: boolean
}

const FALLBACK_FR = 'Tu peux être exactement comme tu es. C\'est déjà suffisant.'
const FALLBACK_EN = 'You can be exactly as you are. It is already enough.'

/**
 * Returns a single affirmation localized to the user's locale.
 * Pulls from mukti.affirmations, weighted random by frequency_weight.
 * Always falls back gracefully — never throws.
 */
export async function getAffirmation(
  category?: AffirmationCategory,
  locale: string = 'fr',
): Promise<{ text: string; id: string | null }> {
  try {
    const sb = createClient()
    let query = sb.from('affirmations').select('*').eq('active', true)
    if (category) query = query.eq('category', category)
    const { data } = await query.limit(40)
    const items = (data ?? []) as Affirmation[]
    if (items.length === 0) return { text: locale === 'en' ? FALLBACK_EN : FALLBACK_FR, id: null }

    // Weighted pick
    const totalWeight = items.reduce((sum, a) => sum + (a.frequency_weight || 1), 0)
    let pick = Math.random() * totalWeight
    let chosen: Affirmation = items[0]
    for (const a of items) {
      pick -= a.frequency_weight || 1
      if (pick <= 0) {
        chosen = a
        break
      }
    }

    const localized =
      locale === 'en' ? chosen.text_en :
      locale === 'es' ? chosen.text_es :
      locale === 'de' ? chosen.text_de :
      locale === 'pt' ? chosen.text_pt :
      locale === 'ar' ? chosen.text_ar :
      locale === 'zh' ? chosen.text_zh :
      locale === 'ja' ? chosen.text_ja :
      null

    return { text: localized || chosen.text_fr || FALLBACK_FR, id: chosen.id }
  } catch {
    return { text: locale === 'en' ? FALLBACK_EN : FALLBACK_FR, id: null }
  }
}

export async function trackAwakening(
  userProfileId: string,
  eventType: string,
  xpGained: number = 1,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const sb = createClient()
    await sb.from('awakening_events').insert({
      user_id: userProfileId,
      event_type: eventType,
      xp_gained: xpGained,
      metadata,
    })
  } catch {
    /* fail silent — éveil ne doit jamais bloquer l'UX */
  }
}

export function getAwakeningLevel(xp: number) {
  return AWAKENING_LEVELS.find((l) => xp >= l.min && xp <= l.max) ?? AWAKENING_LEVELS[0]
}

export function getNextLevel(xp: number) {
  const current = getAwakeningLevel(xp)
  const idx = AWAKENING_LEVELS.findIndex((l) => l.id === current.id)
  if (idx === AWAKENING_LEVELS.length - 1) return null
  return AWAKENING_LEVELS[idx + 1]
}

/**
 * Subtle daily message (not subliminal — always shown consciously).
 * Used in dashboard greeting + push notifications.
 */
export function getSpiritualGreeting(hour: number = new Date().getHours()): string {
  if (hour < 6) return 'La nuit est sacrée. Repose-toi.'
  if (hour < 12) return 'L\'aube est une porte. Franchis-la doucement.'
  if (hour < 18) return 'Le souffle te rappelle à toi-même.'
  if (hour < 22) return 'Le crépuscule honore ce que tu as vécu.'
  return 'La nuit est un refuge. Tu es en sécurité.'
}

// MUKTI G8.1 — Emergency Resources (ressources d'urgence par pays)

import { createServiceClient } from './supabase'
import type { EmergencyCountry } from './constants'

export interface EmergencyResource {
  id: string
  country_code: string
  category: 'suicide' | 'addiction' | 'violence' | 'mental_health' | 'general'
  name_fr: string
  name_en: string
  phone: string | null
  url: string | null
  hours_fr: string | null
  hours_en: string | null
  description_fr: string | null
  description_en: string | null
  priority: number
  active: boolean
}

const ISO_ALIASES: Record<string, string> = {
  GB: 'GB', UK: 'GB',
  US: 'US',
  FR: 'FR',
  ES: 'ES',
  DE: 'DE',
  IT: 'IT',
  PT: 'PT',
  CA: 'CA',
  CH: 'CH',
  BE: 'BE',
  JP: 'JP',
  CN: 'CN',
}

export function normalizeCountryCode(input: string | null | undefined): EmergencyCountry {
  if (!input) return 'INT'
  const up = input.toUpperCase()
  const alias = ISO_ALIASES[up]
  if (alias) return alias as EmergencyCountry
  return 'INT'
}

export async function getResourcesByCountry(
  country: string,
  category?: EmergencyResource['category'],
): Promise<EmergencyResource[]> {
  const admin = createServiceClient()
  const cc = normalizeCountryCode(country)
  let q = admin
    .from('emergency_resources')
    .select('*')
    .eq('active', true)
    .in('country_code', [cc, 'INT'])
    .order('priority', { ascending: false })
  if (category) q = q.eq('category', category)
  const { data } = await q
  return (data ?? []) as EmergencyResource[]
}

export async function getSuicidePreventionResources(country: string): Promise<EmergencyResource[]> {
  return getResourcesByCountry(country, 'suicide')
}

// Detect country from Accept-Language + timezone heuristic
export function inferCountryFromHeaders(acceptLanguage: string | null, timezone: string | null): string {
  if (acceptLanguage) {
    // e.g. "fr-FR,fr;q=0.9" → FR
    const first = acceptLanguage.split(',')[0]?.trim() ?? ''
    const parts = first.split('-')
    if (parts.length >= 2 && parts[1]) {
      return parts[1].toUpperCase()
    }
    const langToCountry: Record<string, string> = {
      fr: 'FR', en: 'US', es: 'ES', de: 'DE', it: 'IT', pt: 'PT', ja: 'JP', zh: 'CN',
    }
    const lang = parts[0]?.toLowerCase() ?? ''
    if (langToCountry[lang]) return langToCountry[lang]!
  }
  if (timezone) {
    const tzMap: Record<string, string> = {
      'Europe/Paris': 'FR', 'Europe/London': 'GB', 'Europe/Madrid': 'ES',
      'Europe/Berlin': 'DE', 'Europe/Rome': 'IT', 'Europe/Lisbon': 'PT',
      'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH',
      'America/New_York': 'US', 'America/Los_Angeles': 'US', 'America/Toronto': 'CA',
      'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN',
    }
    if (tzMap[timezone]) return tzMap[timezone]!
  }
  return 'INT'
}

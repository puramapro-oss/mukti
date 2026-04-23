// MUKTI — G3 intention phrases (banque de phrases conscientes 14 catégories)
// Read-only : seed en SQL (0005), RLS lecture publique si active=true.

import { createServiceClient } from './supabase'
import type { CircleCategoryId } from './constants'

export interface IntentionPhrase {
  id: string
  category: CircleCategoryId
  text_fr: string
  text_en: string
  weight: number
  active: boolean
  created_at: string
}

export async function listPhrasesByCategory(category: CircleCategoryId): Promise<IntentionPhrase[]> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('intention_phrases')
    .select('*')
    .eq('category', category)
    .eq('active', true)
    .order('weight', { ascending: false })

  if (error) return []
  return (data ?? []) as IntentionPhrase[]
}

export async function listPhrasesByIds(ids: string[]): Promise<IntentionPhrase[]> {
  if (!ids || ids.length === 0) return []
  const service = createServiceClient()
  const { data, error } = await service
    .from('intention_phrases')
    .select('*')
    .in('id', ids)
    .eq('active', true)

  if (error) return []
  return (data ?? []) as IntentionPhrase[]
}

export function pickPhraseForLocale(phrase: IntentionPhrase, locale: 'fr' | 'en'): string {
  return locale === 'en' ? phrase.text_en : phrase.text_fr
}

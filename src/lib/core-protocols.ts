// MUKTI — G6 C.O.R.E. Protocols helpers
// 10 protocoles crisis-safe + variantes (universal/human/animal/wildlife/refuge).
// Pure-logic : lookup constants + lazy DB fetch for full steps JSONB.

import { CORE_PROTOCOLS_CATALOG, type CoreProtocolId } from './constants'
import { createServiceClient } from './supabase'

export interface CoreProtocol {
  id: string
  name_fr: string
  name_en: string
  duration_sec: number
  variant: 'human' | 'animal' | 'wildlife' | 'refuge' | 'universal'
  description_fr: string
  description_en: string
  steps: { t: number; label: string; sec: number }[]
  active: boolean
  created_at: string
}

export function isCoreProtocolId(id: string): id is CoreProtocolId {
  return (CORE_PROTOCOLS_CATALOG as readonly { id: string }[]).some(p => p.id === id)
}

export function getProtocolMeta(id: CoreProtocolId) {
  return CORE_PROTOCOLS_CATALOG.find(p => p.id === id) ?? null
}

/** Pick default protocol for a given C.O.R.E. format. */
export function defaultProtocolForFormat(format: 'human' | 'animal' | 'one_planet'): CoreProtocolId {
  switch (format) {
    case 'human':
      return 'recuperation_12min'
    case 'animal':
      return 'animal_calm_5min'
    case 'one_planet':
      return 'one_planet_sync_12min'
  }
}

/** Fetch full protocol (with steps) from DB. */
export async function fetchProtocol(id: string): Promise<CoreProtocol | null> {
  if (!isCoreProtocolId(id)) return null
  const sb = createServiceClient()
  const { data } = await sb
    .schema('mukti')
    .from('core_protocols')
    .select('id, name_fr, name_en, duration_sec, variant, description_fr, description_en, steps, active, created_at')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle()
  return data as CoreProtocol | null
}

/** List all active protocols (cached implicit via PostgREST edge). */
export async function listProtocols(variant?: CoreProtocol['variant']): Promise<CoreProtocol[]> {
  const sb = createServiceClient()
  let q = sb
    .schema('mukti')
    .from('core_protocols')
    .select('id, name_fr, name_en, duration_sec, variant, description_fr, description_en, steps, active, created_at')
    .eq('active', true)
    .order('id')
  if (variant) q = q.eq('variant', variant)
  const { data } = await q
  return (data ?? []) as CoreProtocol[]
}

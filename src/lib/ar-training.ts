// MUKTI — G4 AR Energy Mirror
// Server-side helpers : progression tuto Soin + Manifestation (5 étapes chacun).

import { createServerSupabaseClient } from './supabase-server'
import type { ArTrainingMode } from './constants'

export interface ArTrainingProgressRow {
  id: string
  user_id: string
  mode: ArTrainingMode
  step: 1 | 2 | 3 | 4 | 5
  completed_at: string
}

export async function markTrainingStep(
  userProfileId: string,
  mode: ArTrainingMode,
  step: 1 | 2 | 3 | 4 | 5
): Promise<{ ok: true; progress: ArTrainingProgressRow } | { ok: false; error: string }> {
  const sb = await createServerSupabaseClient()
  const { data, error } = await sb
    .from('ar_training_progress')
    .upsert(
      { user_id: userProfileId, mode, step },
      { onConflict: 'user_id,mode,step', ignoreDuplicates: false }
    )
    .select('*')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, progress: data as ArTrainingProgressRow }
}

export async function getTrainingProgress(
  userProfileId: string
): Promise<{ soin: number[]; manifestation: number[]; soin_completed: boolean; manifestation_completed: boolean }> {
  const sb = await createServerSupabaseClient()
  const { data } = await sb
    .from('ar_training_progress')
    .select('mode, step')
    .eq('user_id', userProfileId)

  const rows = (data as { mode: ArTrainingMode; step: number }[] | null) ?? []
  const soin = [...new Set(rows.filter((r) => r.mode === 'soin').map((r) => r.step))].sort((a, b) => a - b)
  const manifestation = [...new Set(rows.filter((r) => r.mode === 'manifestation').map((r) => r.step))].sort((a, b) => a - b)
  return {
    soin,
    manifestation,
    soin_completed: soin.length === 5,
    manifestation_completed: manifestation.length === 5,
  }
}

// MUKTI — G6 Mode 16 Énergie de Remplacement
// 5 canaux Solfeggio : motivation / calme / confiance / énergie / concentration.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { ENERGY_REPLACEMENT_CHANNELS, type EnergyChannel } from './constants'

export interface EnergySession {
  id: string
  user_id: string
  channel: EnergyChannel
  duration_sec: number | null
  started_at: string
  completed_at: string | null
  urge_before: number | null
  urge_after: number | null
  created_at: string
}

export function isEnergyChannel(v: string): v is EnergyChannel {
  return (ENERGY_REPLACEMENT_CHANNELS as readonly { id: string }[]).some(c => c.id === v)
}

export function getChannelMeta(id: EnergyChannel) {
  return ENERGY_REPLACEMENT_CHANNELS.find(c => c.id === id) ?? null
}

export interface LogSessionInput {
  channel: EnergyChannel
  duration_sec?: number
  completed?: boolean
  urge_before?: number
  urge_after?: number
}

/** Log a completed (or abandoned) energy replacement session. */
export async function logEnergySession(input: LogSessionInput): Promise<{
  session: EnergySession | null
  error: string | null
}> {
  if (!isEnergyChannel(input.channel)) {
    return { session: null, error: 'Canal invalide.' }
  }
  if (input.duration_sec != null && (input.duration_sec < 0 || input.duration_sec > 1800)) {
    return { session: null, error: 'Durée invalide.' }
  }
  for (const u of [input.urge_before, input.urge_after]) {
    if (u != null && (u < 1 || u > 10)) {
      return { session: null, error: 'Niveau d\'envie entre 1 et 10.' }
    }
  }

  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { session: null, error: 'Profil introuvable — reconnecte-toi.' }

  const sb = createServiceClient()
  const now = new Date().toISOString()
  const { data, error } = await sb
    .schema('mukti')
    .from('energy_replacement_sessions')
    .insert({
      user_id: profileId,
      channel: input.channel,
      duration_sec: input.duration_sec ?? null,
      started_at: now,
      completed_at: input.completed ? now : null,
      urge_before: input.urge_before ?? null,
      urge_after: input.urge_after ?? null,
    })
    .select('*')
    .single()
  if (error || !data) {
    return { session: null, error: 'Impossible d\'enregistrer la session.' }
  }
  return { session: data as EnergySession, error: null }
}

export async function listEnergySessions(limit: number = 20): Promise<EnergySession[]> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return []
  const sb = createServiceClient()
  const { data } = await sb
    .schema('mukti')
    .from('energy_replacement_sessions')
    .select('*')
    .eq('user_id', profileId)
    .order('started_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)))
  return (data ?? []) as EnergySession[]
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

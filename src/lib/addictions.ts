// MUKTI — Libération Addictions (G2)
// Helpers server-side pour déclaration + CRUD addictions.
// RLS : owner rw via mukti.current_profile_id() — toutes les calls utilisent SSR client.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { ADDICTION_TYPES, MAX_ACTIVE_ADDICTIONS, type AddictionId } from './constants'

export type AddictionStatus = 'active' | 'paused' | 'liberated' | 'archived'
export type AddictionGoal = 'reduce' | 'stop'

export interface Addiction {
  id: string
  user_id: string
  type: AddictionId
  severity: 1 | 2 | 3 | 4 | 5
  frequency_daily: number | null
  started_ago_months: number | null
  triggers: string[]
  goal: AddictionGoal
  status: AddictionStatus
  custom_label: string | null
  declared_at: string
  liberated_at: string | null
  created_at: string
  updated_at: string
}

export interface DeclareAddictionInput {
  type: AddictionId
  severity: 1 | 2 | 3 | 4 | 5
  frequency_daily?: number
  started_ago_months?: number
  triggers?: string[]
  goal?: AddictionGoal
  custom_label?: string
}

export function getAddictionMeta(id: AddictionId) {
  return ADDICTION_TYPES.find(t => t.id === id)
}

export function isValidAddictionType(value: string): value is AddictionId {
  return (ADDICTION_TYPES as readonly { id: string }[]).some(t => t.id === value)
}

/**
 * Déclare une addiction pour l'utilisateur authentifié.
 * Triggers DB : addictions_enforce_max_active (3 max) + addictions_create_streak (j0 auto).
 * Retourne { addiction, blocked } où blocked=true si > MAX_ACTIVE_ADDICTIONS.
 */
export async function declareAddictionForCurrentUser(
  input: DeclareAddictionInput
): Promise<{ addiction: Addiction | null; error: string | null }> {
  const supabase = await createServerSupabaseClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { addiction: null, error: 'Non authentifié — reconnecte-toi.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (profileError || !profile) {
    return { addiction: null, error: 'Profil introuvable. Contacte le support.' }
  }

  const { count, error: countError } = await supabase
    .from('addictions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('status', 'active')

  if (countError) {
    return { addiction: null, error: 'Erreur lecture addictions — réessaie.' }
  }
  if ((count ?? 0) >= MAX_ACTIVE_ADDICTIONS) {
    return {
      addiction: null,
      error: `Tu as déjà ${MAX_ACTIVE_ADDICTIONS} libérations en cours — libère-toi d'une avant d'en ajouter une nouvelle.`,
    }
  }

  const { data, error } = await supabase
    .from('addictions')
    .insert({
      user_id: profile.id,
      type: input.type,
      severity: input.severity,
      frequency_daily: input.frequency_daily ?? null,
      started_ago_months: input.started_ago_months ?? null,
      triggers: input.triggers ?? [],
      goal: input.goal ?? 'stop',
      custom_label: input.custom_label ?? null,
      status: 'active',
    })
    .select('*')
    .single()

  if (error) {
    if (error.message.includes('MUKTI_MAX_ACTIVE_ADDICTIONS')) {
      return { addiction: null, error: `Tu as déjà ${MAX_ACTIVE_ADDICTIONS} libérations actives.` }
    }
    return { addiction: null, error: `Impossible de déclarer — ${error.message}` }
  }

  return { addiction: data as Addiction, error: null }
}

export async function getUserActiveAddictions(): Promise<Addiction[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('addictions')
    .select('*')
    .eq('status', 'active')
    .order('declared_at', { ascending: false })

  if (error) return []
  return (data ?? []) as Addiction[]
}

export async function getAddictionById(id: string): Promise<Addiction | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('addictions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return data as Addiction
}

export async function updateAddictionStatus(
  id: string,
  status: AddictionStatus
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createServerSupabaseClient()
  const patch: { status: AddictionStatus; liberated_at?: string } = { status }
  if (status === 'liberated') patch.liberated_at = new Date().toISOString()

  const { error } = await supabase.from('addictions').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}

/** Service-role variante pour CRON / webhooks : bypass RLS. */
export async function getAllActiveAddictionsForCron(): Promise<Addiction[]> {
  const admin = createServiceClient()
  const { data, error } = await admin
    .from('addictions')
    .select('*')
    .eq('status', 'active')

  if (error) return []
  return (data ?? []) as Addiction[]
}

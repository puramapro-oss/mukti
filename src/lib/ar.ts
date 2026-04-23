// MUKTI — G4 AR Energy Mirror
// Server-side helpers : species, beacons, calibration, sessions.
// Pattern : user_id = mukti.profiles(id) (résolu via current_profile_id()).

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import type {
  ArSpeciesSlug,
  ArRigType,
  ArBeaconType,
  ArSessionMode,
} from './constants'

// ---------------------------------------------------------------------------
// Helper : résout profiles.id depuis la session SSR (RLS profiles_select_own OK).
// Nécessaire car mukti.profiles.id ≠ auth.users.id (id = gen_random_uuid()).
// Accepte n'importe quel SupabaseClient (schema mukti ou public).
// ---------------------------------------------------------------------------
type MuktiSbClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export async function resolveProfileId(sb: MuktiSbClient): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export interface ArSpecies {
  id: string
  slug: ArSpeciesSlug
  name_fr: string
  name_en: string
  rig_type: ArRigType
  energy_color: string
  icon_glyph: string
  description_fr: string
  description_en: string
  sort_order: number
  locked: boolean
  active: boolean
  created_at: string
}

export interface ArBeacon {
  id: string
  slug: string
  name_fr: string
  name_en: string
  type: ArBeaconType
  latitude: number | null
  longitude: number | null
  image_url: string | null
  description_fr: string
  description_en: string
  intention_hint: string | null
  sort_order: number
  active: boolean
  created_at: string
}

export interface ArCalibration {
  user_id: string
  shoulder_width: number
  torso_length: number
  arm_span: number
  hip_width: number
  calibration_quality: 'low' | 'medium' | 'high'
  calibration_frames: number
  updated_at: string
}

export interface ArSession {
  id: string
  user_id: string
  mode: ArSessionMode
  species_slug: ArSpeciesSlug | null
  beacon_slug: string | null
  ceremony_id: string | null
  duration_sec: number
  intensity_1_5: number | null
  fallback_imaginary: boolean
  completed: boolean
  started_at: string
  finished_at: string | null
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// SPECIES — lecture publique (anon RLS policy active)
// ---------------------------------------------------------------------------
export async function listSpecies(): Promise<{ ok: true; species: ArSpecies[] } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('ar_species_catalog')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, species: (data as ArSpecies[]) ?? [] }
}

export async function getSpeciesBySlug(slug: ArSpeciesSlug): Promise<ArSpecies | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('ar_species_catalog')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()
  return (data as ArSpecies | null) ?? null
}

// ---------------------------------------------------------------------------
// BEACONS — lecture publique (anon RLS policy active)
// ---------------------------------------------------------------------------
export interface ListBeaconsFilters {
  type?: ArBeaconType
  intention_hint?: string
}

export async function listBeacons(filters: ListBeaconsFilters = {}): Promise<{ ok: true; beacons: ArBeacon[] } | { ok: false; error: string }> {
  const sb = createServiceClient()
  let query = sb.from('ar_beacons').select('*').eq('active', true).order('sort_order', { ascending: true })
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.intention_hint) query = query.eq('intention_hint', filters.intention_hint)
  const { data, error } = await query
  if (error) return { ok: false, error: error.message }
  return { ok: true, beacons: (data as ArBeacon[]) ?? [] }
}

export async function getBeaconBySlug(slug: string): Promise<ArBeacon | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('ar_beacons')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()
  return (data as ArBeacon | null) ?? null
}

// ---------------------------------------------------------------------------
// CALIBRATION — lecture / upsert propre user
// ---------------------------------------------------------------------------
export async function getCalibration(userProfileId: string): Promise<ArCalibration | null> {
  const sb = await createServerSupabaseClient()
  const { data } = await sb
    .from('ar_calibrations')
    .select('*')
    .eq('user_id', userProfileId)
    .maybeSingle()
  return (data as ArCalibration | null) ?? null
}

export interface SaveCalibrationInput {
  user_id: string
  shoulder_width: number
  torso_length: number
  arm_span: number
  hip_width: number
  calibration_quality?: 'low' | 'medium' | 'high'
  calibration_frames?: number
}

export async function saveCalibration(input: SaveCalibrationInput): Promise<{ ok: true; calibration: ArCalibration } | { ok: false; error: string }> {
  const sb = await createServerSupabaseClient()
  const payload = {
    user_id: input.user_id,
    shoulder_width: input.shoulder_width,
    torso_length: input.torso_length,
    arm_span: input.arm_span,
    hip_width: input.hip_width,
    calibration_quality: input.calibration_quality ?? 'medium',
    calibration_frames: input.calibration_frames ?? 30,
  }
  const { data, error } = await sb
    .from('ar_calibrations')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, calibration: data as ArCalibration }
}

// ---------------------------------------------------------------------------
// SESSIONS — create / complete / list own history
// ---------------------------------------------------------------------------
export interface CreateSessionInput {
  user_id: string
  mode: ArSessionMode
  species_slug?: ArSpeciesSlug | null
  beacon_slug?: string | null
  ceremony_id?: string | null
  fallback_imaginary?: boolean
}

export async function createSession(input: CreateSessionInput): Promise<{ ok: true; session: ArSession } | { ok: false; error: string }> {
  const sb = await createServerSupabaseClient()
  const payload = {
    user_id: input.user_id,
    mode: input.mode,
    species_slug: input.species_slug ?? null,
    beacon_slug: input.beacon_slug ?? null,
    ceremony_id: input.ceremony_id ?? null,
    fallback_imaginary: input.fallback_imaginary ?? false,
    duration_sec: 0,
    completed: false,
  }
  const { data, error } = await sb
    .from('ar_sessions')
    .insert(payload)
    .select('*')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, session: data as ArSession }
}

export interface CompleteSessionInput {
  session_id: string
  user_id: string
  duration_sec: number
  intensity_1_5?: number | null
  metadata?: Record<string, unknown>
}

export async function completeSession(input: CompleteSessionInput): Promise<{ ok: true; session: ArSession } | { ok: false; error: string }> {
  const sb = await createServerSupabaseClient()
  const { data, error } = await sb
    .from('ar_sessions')
    .update({
      duration_sec: Math.max(0, Math.min(7200, Math.floor(input.duration_sec))),
      intensity_1_5: input.intensity_1_5 ?? null,
      completed: true,
      finished_at: new Date().toISOString(),
      metadata: input.metadata ?? {},
    })
    .eq('id', input.session_id)
    .eq('user_id', input.user_id)
    .select('*')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, session: data as ArSession }
}

export async function listSessionHistory(userProfileId: string, limit = 30): Promise<ArSession[]> {
  const sb = await createServerSupabaseClient()
  const { data } = await sb
    .from('ar_sessions')
    .select('*')
    .eq('user_id', userProfileId)
    .order('started_at', { ascending: false })
    .limit(limit)
  return (data as ArSession[] | null) ?? []
}

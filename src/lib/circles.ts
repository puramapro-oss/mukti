// MUKTI — G3 Cercles d'Intention ∞
// Helpers server-side CRUD + join/leave/rotation.
// RLS : circles SELECT public (open|live|finished), WRITE owner via current_profile_id().

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import {
  CIRCLE_CATEGORIES,
  CIRCLE_GUIDANCE_MODES,
  CIRCLE_ROTATION_MODES,
  CIRCLE_MESH_MAX_PARTICIPANTS,
  type CircleCategoryId,
  type CircleGuidanceMode,
  type CircleRotationMode,
} from './constants'

export type CircleStatus = 'open' | 'live' | 'finished' | 'cancelled'
export type CircleAudioMode = 'mesh' | 'sfu' | 'auto'
export type CircleParticipantRole = 'participant' | 'creator' | 'moderator'

export interface Circle {
  id: string
  creator_id: string
  category: CircleCategoryId
  title: string
  description: string | null
  max_participants: number
  duration_per_person_sec: number
  rotation_mode: CircleRotationMode
  guidance_mode: CircleGuidanceMode
  audio_mode: CircleAudioMode
  selected_phrase_ids: string[]
  livekit_room_name: string | null
  recording_enabled: boolean
  auto_start_when_full: boolean
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  status: CircleStatus
  created_at: string
  updated_at: string
}

export interface CircleParticipant {
  id: string
  circle_id: string
  user_id: string
  role: CircleParticipantRole
  rotation_position: number
  received_focus: boolean
  mic_muted: boolean
  cam_enabled: boolean
  joined_at: string
  left_at: string | null
}

export interface CircleRotation {
  id: string
  circle_id: string
  round_number: number
  focused_user_id: string
  started_at: string
  ended_at: string | null
  planned_duration_sec: number
  actual_duration_sec: number | null
}

export interface CreateCircleInput {
  category: CircleCategoryId
  title: string
  description?: string
  max_participants: number
  duration_per_person_sec?: number
  rotation_mode?: CircleRotationMode
  guidance_mode?: CircleGuidanceMode
  selected_phrase_ids?: string[]
  recording_enabled?: boolean
  auto_start_when_full?: boolean
  scheduled_at?: string | null
}

export function isValidCategory(v: string): v is CircleCategoryId {
  return (CIRCLE_CATEGORIES as readonly { id: string }[]).some((c) => c.id === v)
}

export function isValidGuidance(v: string): v is CircleGuidanceMode {
  return (CIRCLE_GUIDANCE_MODES as readonly { id: string }[]).some((c) => c.id === v)
}

export function isValidRotation(v: string): v is CircleRotationMode {
  return (CIRCLE_ROTATION_MODES as readonly { id: string }[]).some((c) => c.id === v)
}

/**
 * Choisit le mode audio selon nombre de participants attendus.
 * ≤ 8 → mesh WebRTC, > 8 → SFU LiveKit.
 */
export function resolveAudioMode(maxParticipants: number): 'mesh' | 'sfu' {
  return maxParticipants <= CIRCLE_MESH_MAX_PARTICIPANTS ? 'mesh' : 'sfu'
}

/** Génère un room name LiveKit unique par cercle */
export function livekitRoomName(circleId: string): string {
  return `mukti-${circleId}`
}

/**
 * Crée un cercle. L'utilisateur courant devient automatiquement creator (trigger DB).
 * Le mode audio est auto-calculé depuis max_participants.
 */
export async function createCircle(input: CreateCircleInput): Promise<Circle> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('MUKTI_NOT_AUTHENTICATED')
  }

  const audioMode = resolveAudioMode(input.max_participants)
  const scheduledAt = input.scheduled_at ?? null

  const { data, error } = await supabase
    .from('circles')
    .insert({
      creator_id: user.id,
      category: input.category,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      max_participants: input.max_participants,
      duration_per_person_sec: input.duration_per_person_sec ?? 300,
      rotation_mode: input.rotation_mode ?? 'auto',
      guidance_mode: input.guidance_mode ?? 'voice',
      audio_mode: audioMode,
      selected_phrase_ids: input.selected_phrase_ids ?? [],
      recording_enabled: input.recording_enabled ?? false,
      auto_start_when_full: input.auto_start_when_full ?? true,
      scheduled_at: scheduledAt,
      status: 'open',
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`MUKTI_CREATE_CIRCLE_FAILED: ${error.message}`)
  }

  // attribue livekit_room_name si SFU
  if (audioMode === 'sfu') {
    await supabase
      .from('circles')
      .update({ livekit_room_name: livekitRoomName(data.id) })
      .eq('id', data.id)
  }

  return data as Circle
}

export async function listOpenCircles(params?: {
  category?: CircleCategoryId
  status?: CircleStatus[]
  limit?: number
}): Promise<Array<Circle & { participant_count: number }>> {
  const supabase = await createServerSupabaseClient()
  const statuses = params?.status ?? ['open', 'live']

  let query = supabase
    .from('circles')
    .select('*')
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 50)

  if (params?.category) {
    query = query.eq('category', params.category)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`MUKTI_LIST_CIRCLES_FAILED: ${error.message}`)
  }

  // fetch participant counts (1 query pour tous)
  const ids = (data ?? []).map((c: { id: string }) => c.id)
  if (ids.length === 0) return []

  const service = createServiceClient()
  const { data: counts } = await service
    .from('circle_participants')
    .select('circle_id')
    .in('circle_id', ids)
    .is('left_at', null)

  const countMap = new Map<string, number>()
  ;(counts ?? []).forEach((row: { circle_id: string }) => {
    countMap.set(row.circle_id, (countMap.get(row.circle_id) ?? 0) + 1)
  })

  return (data ?? []).map((c) => ({
    ...(c as Circle),
    participant_count: countMap.get(c.id) ?? 0,
  }))
}

export async function getCircleDetails(circleId: string): Promise<{
  circle: Circle
  participants: CircleParticipant[]
  current_rotation: CircleRotation | null
} | null> {
  const supabase = await createServerSupabaseClient()

  const { data: circle, error: cErr } = await supabase
    .from('circles')
    .select('*')
    .eq('id', circleId)
    .maybeSingle()

  if (cErr || !circle) return null

  const { data: participants } = await supabase
    .from('circle_participants')
    .select('*')
    .eq('circle_id', circleId)
    .is('left_at', null)
    .order('rotation_position', { ascending: true })

  const { data: rotation } = await supabase
    .from('circle_rotations')
    .select('*')
    .eq('circle_id', circleId)
    .is('ended_at', null)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    circle: circle as Circle,
    participants: (participants ?? []) as CircleParticipant[],
    current_rotation: (rotation ?? null) as CircleRotation | null,
  }
}

export async function joinCircle(circleId: string): Promise<CircleParticipant> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('MUKTI_NOT_AUTHENTICATED')

  // Vérifie capacité (service client bypass RLS pour count exact)
  const service = createServiceClient()
  const { data: circle } = await service
    .from('circles')
    .select('max_participants, status')
    .eq('id', circleId)
    .maybeSingle()

  if (!circle) throw new Error('MUKTI_CIRCLE_NOT_FOUND')
  if (circle.status !== 'open' && circle.status !== 'live') {
    throw new Error('MUKTI_CIRCLE_CLOSED')
  }

  const { count } = await service
    .from('circle_participants')
    .select('id', { count: 'exact', head: true })
    .eq('circle_id', circleId)
    .is('left_at', null)

  if ((count ?? 0) >= circle.max_participants) {
    throw new Error('MUKTI_CIRCLE_FULL')
  }

  // upsert : si déjà présent (left_at IS NULL), retourne sans erreur
  const { data: existing } = await supabase
    .from('circle_participants')
    .select('*')
    .eq('circle_id', circleId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing && !existing.left_at) {
    return existing as CircleParticipant
  }

  if (existing && existing.left_at) {
    // rejoindre après départ : nettoie left_at
    const { data, error } = await supabase
      .from('circle_participants')
      .update({ left_at: null, joined_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw new Error(`MUKTI_REJOIN_FAILED: ${error.message}`)
    return data as CircleParticipant
  }

  const { data, error } = await supabase
    .from('circle_participants')
    .insert({
      circle_id: circleId,
      user_id: user.id,
      role: 'participant',
    })
    .select('*')
    .single()

  if (error) throw new Error(`MUKTI_JOIN_FAILED: ${error.message}`)
  return data as CircleParticipant
}

export async function leaveCircle(circleId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('MUKTI_NOT_AUTHENTICATED')

  const { error } = await supabase
    .from('circle_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('circle_id', circleId)
    .eq('user_id', user.id)
    .is('left_at', null)

  if (error) throw new Error(`MUKTI_LEAVE_FAILED: ${error.message}`)
}

/**
 * Avance la rotation : ferme la précédente + crée la suivante.
 * Seul le creator ou moderator peut déclencher manuellement (mode 'fixed').
 * Pour 'auto', appelé par le client quand le timer local expire.
 * 'random' choisit next random parmi les non-focus-yet.
 */
export async function advanceRotation(circleId: string): Promise<CircleRotation | null> {
  const supabase = await createServerSupabaseClient()
  const service = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('MUKTI_NOT_AUTHENTICATED')

  // vérifie rôle
  const { data: me } = await service
    .from('circle_participants')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', user.id)
    .maybeSingle()

  const role = (me as { role?: string } | null)?.role
  if (role !== 'creator' && role !== 'moderator') {
    throw new Error('MUKTI_NOT_AUTHORIZED')
  }

  const { data: circle } = await service
    .from('circles')
    .select('duration_per_person_sec, rotation_mode, status')
    .eq('id', circleId)
    .single()

  if (!circle) throw new Error('MUKTI_CIRCLE_NOT_FOUND')
  if ((circle as { status: string }).status !== 'live') {
    throw new Error('MUKTI_CIRCLE_NOT_LIVE')
  }

  const { data: participants } = await service
    .from('circle_participants')
    .select('user_id, rotation_position, received_focus')
    .eq('circle_id', circleId)
    .is('left_at', null)
    .order('rotation_position', { ascending: true })

  if (!participants || participants.length === 0) {
    throw new Error('MUKTI_NO_PARTICIPANTS')
  }

  // ferme la rotation active
  const { data: current } = await service
    .from('circle_rotations')
    .select('id, focused_user_id, started_at, round_number')
    .eq('circle_id', circleId)
    .is('ended_at', null)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextRound = 1
  if (current) {
    const startedAt = new Date((current as { started_at: string }).started_at).getTime()
    const actualSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))

    await service
      .from('circle_rotations')
      .update({
        ended_at: new Date().toISOString(),
        actual_duration_sec: actualSec,
      })
      .eq('id', (current as { id: string }).id)

    await service
      .from('circle_participants')
      .update({ received_focus: true })
      .eq('circle_id', circleId)
      .eq('user_id', (current as { focused_user_id: string }).focused_user_id)

    nextRound = (current as { round_number: number }).round_number + 1
  }

  // sélectionne next focus
  const notYet = participants.filter(
    (p) => !(p as { received_focus?: boolean }).received_focus,
  )
  const pool = notYet.length > 0 ? notYet : participants

  let nextFocus: { user_id: string }
  if ((circle as { rotation_mode: string }).rotation_mode === 'random') {
    nextFocus = pool[Math.floor(Math.random() * pool.length)] as { user_id: string }
  } else {
    nextFocus = pool[0] as { user_id: string }
  }

  const { data: inserted, error } = await service
    .from('circle_rotations')
    .insert({
      circle_id: circleId,
      round_number: nextRound,
      focused_user_id: nextFocus.user_id,
      planned_duration_sec: (circle as { duration_per_person_sec: number }).duration_per_person_sec,
    })
    .select('*')
    .single()

  if (error) throw new Error(`MUKTI_ROTATION_INSERT_FAILED: ${error.message}`)
  return inserted as CircleRotation
}

/**
 * Démarre le premier round si status=live et aucune rotation ouverte.
 * Appelé automatiquement par la room quand tous les participants sont connectés.
 */
export async function startFirstRotation(circleId: string): Promise<CircleRotation | null> {
  const service = createServiceClient()

  const { data: circle } = await service
    .from('circles')
    .select('status, duration_per_person_sec, rotation_mode')
    .eq('id', circleId)
    .single()

  if (!circle || (circle as { status: string }).status !== 'live') return null

  const { data: existing } = await service
    .from('circle_rotations')
    .select('id')
    .eq('circle_id', circleId)
    .limit(1)

  if (existing && existing.length > 0) return null

  const { data: participants } = await service
    .from('circle_participants')
    .select('user_id, rotation_position')
    .eq('circle_id', circleId)
    .is('left_at', null)
    .order('rotation_position', { ascending: true })

  if (!participants || participants.length === 0) return null

  const firstFocus =
    (circle as { rotation_mode: string }).rotation_mode === 'random'
      ? participants[Math.floor(Math.random() * participants.length)]
      : participants[0]

  const { data, error } = await service
    .from('circle_rotations')
    .insert({
      circle_id: circleId,
      round_number: 1,
      focused_user_id: (firstFocus as { user_id: string }).user_id,
      planned_duration_sec: (circle as { duration_per_person_sec: number }).duration_per_person_sec,
    })
    .select('*')
    .single()

  if (error) return null
  return data as CircleRotation
}

/** Si status=open et scheduled_at dépassé, passe en live + crée 1ère rotation */
export async function maybeStartLiveBySchedule(circleId: string): Promise<boolean> {
  const service = createServiceClient()
  const { data: circle } = await service
    .from('circles')
    .select('status, scheduled_at')
    .eq('id', circleId)
    .single()

  if (!circle) return false
  const c = circle as { status: string; scheduled_at: string | null }
  if (c.status !== 'open' || !c.scheduled_at) return false
  if (new Date(c.scheduled_at).getTime() > Date.now()) return false

  await service
    .from('circles')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', circleId)

  await startFirstRotation(circleId)
  return true
}

/**
 * Auto-mute si un user a reçu ≥3 reports distincts dans un cercle.
 * Appelé après chaque insert circle_reports (server-side).
 */
export async function checkReportsAutoMute(circleId: string, reportedUserId: string): Promise<boolean> {
  const service = createServiceClient()
  const { count } = await service
    .from('circle_reports')
    .select('id', { count: 'exact', head: true })
    .eq('circle_id', circleId)
    .eq('reported_user_id', reportedUserId)

  if ((count ?? 0) >= 3) {
    await service
      .from('circle_participants')
      .update({ mic_muted: true })
      .eq('circle_id', circleId)
      .eq('user_id', reportedUserId)
    return true
  }
  return false
}

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
import type {
  CircleStatus,
  CircleAudioMode,
  CircleParticipantRole,
  Circle,
  CircleParticipant,
  CircleRotation,
  CreateCircleInput,
} from './circles-types'

export type {
  CircleStatus,
  CircleAudioMode,
  CircleParticipantRole,
  Circle,
  CircleParticipant,
  CircleRotation,
  CreateCircleInput,
} from './circles-types'

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

// Rotation et admin — réexportés depuis circles-rotation.ts
export {
  advanceRotation,
  startFirstRotation,
  maybeStartLiveBySchedule,
  checkReportsAutoMute,
} from './circles-rotation'

// MUKTI — G3 Cercles : logique de rotation et admin
// Extrait de circles.ts pour respecter max-lines

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import type { CircleRotation } from './circles-types'

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
    .select('duration_per_person_sec, status, rotation_mode')
    .eq('id', circleId)
    .single()

  if (!circle) return null
  const c = circle as { status: string; duration_per_person_sec: number; rotation_mode: string }
  if (c.status !== 'live') return null

  const { data: existing } = await service
    .from('circle_rotations')
    .select('id')
    .eq('circle_id', circleId)
    .is('ended_at', null)
    .limit(1)
    .maybeSingle()

  if (existing) return null

  const { data: participants } = await service
    .from('circle_participants')
    .select('user_id, rotation_position')
    .eq('circle_id', circleId)
    .is('left_at', null)
    .order('rotation_position', { ascending: true })

  if (!participants || participants.length === 0) return null

  let focusedUser: { user_id: string }
  if (c.rotation_mode === 'random') {
    focusedUser = participants[Math.floor(Math.random() * participants.length)] as { user_id: string }
  } else {
    focusedUser = participants[0] as { user_id: string }
  }

  const { data, error } = await service
    .from('circle_rotations')
    .insert({
      circle_id: circleId,
      round_number: 1,
      focused_user_id: focusedUser.user_id,
      planned_duration_sec: c.duration_per_person_sec,
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

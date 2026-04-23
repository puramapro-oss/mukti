'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { CircleRotation } from '@/lib/circles'

interface UseRotationSyncParams {
  circleId: string
  currentRotation: CircleRotation | null
  rotationMode: 'auto' | 'random' | 'fixed'
  canAdvance: boolean
  circleStatus: 'open' | 'live' | 'finished' | 'cancelled'
}

interface UseRotationSyncResult {
  rotation: CircleRotation | null
  secondsRemaining: number
  roundNumber: number
  focusedUserId: string | null
  progressPercent: number
}

/**
 * Synchronise rotation collective.
 * - Timer source: rotation.started_at + planned_duration_sec
 * - Tous les clients calculent le même secondsRemaining localement (±drift réseau)
 * - Supabase Realtime postgres_changes INSERT circle_rotations → update UI immédiat
 * - Si mode=auto et canAdvance (creator/moderator) et timer=0 → trigger advance-rotation
 */
export function useRotationSync(params: UseRotationSyncParams): UseRotationSyncResult {
  const [rotation, setRotation] = useState<CircleRotation | null>(params.currentRotation)
  const [tick, setTick] = useState(0)
  const advancingRef = useRef(false)

  // sync externe → état local
  useEffect(() => {
    setRotation(params.currentRotation)
  }, [params.currentRotation])

  // tick 1s pour recompute secondsRemaining
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000)
    return () => clearInterval(id)
  }, [])

  // subscribe Realtime circle_rotations
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`rotations-${params.circleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'mukti', table: 'circle_rotations', filter: `circle_id=eq.${params.circleId}` },
        (payload) => {
          const r = payload.new as CircleRotation
          setRotation(r)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'mukti', table: 'circle_rotations', filter: `circle_id=eq.${params.circleId}` },
        (payload) => {
          const r = payload.new as CircleRotation
          // Si la rotation courante a ended_at, on attend l'INSERT suivante
          setRotation((prev) => (prev?.id === r.id ? r : prev))
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [params.circleId])

  // auto-advance pour mode 'auto' + canAdvance + timer expiré
  useEffect(() => {
    if (params.rotationMode !== 'auto') return
    if (!params.canAdvance) return
    if (!rotation || rotation.ended_at) return
    if (params.circleStatus !== 'live') return

    const sec = computeSecondsRemaining(rotation)
    if (sec > 0) return
    if (advancingRef.current) return

    advancingRef.current = true
    fetch(`/api/circles/${params.circleId}/advance-rotation`, { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => {
          advancingRef.current = false
        }, 2000)
      })
  }, [tick, rotation, params.rotationMode, params.canAdvance, params.circleId, params.circleStatus])

  const secondsRemaining = rotation ? Math.max(0, computeSecondsRemaining(rotation)) : 0
  const progressPercent = rotation
    ? Math.min(100, Math.max(0, (1 - secondsRemaining / rotation.planned_duration_sec) * 100))
    : 0

  // référence tick pour forcer recompute sans warning
  void tick

  return {
    rotation,
    secondsRemaining,
    roundNumber: rotation?.round_number ?? 0,
    focusedUserId: rotation?.focused_user_id ?? null,
    progressPercent,
  }
}

function computeSecondsRemaining(r: CircleRotation): number {
  const started = new Date(r.started_at).getTime()
  const elapsed = Math.floor((Date.now() - started) / 1000)
  return r.planned_duration_sec - elapsed
}

'use client'

// MUKTI — G4.7 useCeremonySync
// Souscrit postgres_changes UPDATE sur mukti.ar_ceremonies pour ceremonyId donné
// + timer local drift-tolerant (compute depuis scheduled_at/started_at/duration_sec)
// + poll participant count via refresh fetch /api/ar/ceremonies/[id] toutes 10s.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import type { ArCeremony } from '@/lib/ar-ceremony'

export type CeremonyPhase = 'upcoming' | 'starting' | 'live' | 'finished' | 'cancelled'

export interface CeremonySyncState {
  ceremony: ArCeremony | null
  phase: CeremonyPhase
  secondsUntilStart: number
  secondsIntoLive: number
  secondsRemaining: number
  participantsCount: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const STARTING_WINDOW_SEC = 3

export function useCeremonySync(ceremonyId: string | null): CeremonySyncState {
  const [ceremony, setCeremony] = useState<ArCeremony | null>(null)
  const [participantsCount, setParticipantsCount] = useState(0)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(ceremonyId))
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollTimerRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    if (!ceremonyId) return
    try {
      const res = await fetch(`/api/ar/ceremonies/${ceremonyId}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Cérémonie indisponible.')
        return
      }
      setCeremony(data.ceremony)
      setParticipantsCount(data.ceremony?.participants_count ?? 0)
      setError(null)
    } catch {
      setError('Erreur réseau.')
    } finally {
      setIsLoading(false)
    }
  }, [ceremonyId])

  // Initial fetch + poll participants toutes les 10 s (fallback sans Realtime)
  useEffect(() => {
    if (!ceremonyId) {
      setCeremony(null)
      setIsLoading(false)
      return
    }
    void refresh()
    pollTimerRef.current = window.setInterval(refresh, 10_000)
    return () => {
      if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current)
    }
  }, [ceremonyId, refresh])

  // Realtime postgres_changes UPDATE sur la cérémonie
  useEffect(() => {
    if (!ceremonyId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`ar_ceremony_${ceremonyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'mukti',
          table: 'ar_ceremonies',
          filter: `id=eq.${ceremonyId}`,
        },
        (payload) => {
          const next = payload.new as ArCeremony
          setCeremony((prev) => {
            if (!prev) return next
            return { ...prev, ...next }
          })
        },
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [ceremonyId])

  // Realtime participants (insert/update)
  useEffect(() => {
    if (!ceremonyId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`ar_ceremony_cp_${ceremonyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'mukti',
          table: 'ar_ceremony_participants',
          filter: `ceremony_id=eq.${ceremonyId}`,
        },
        () => {
          setParticipantsCount((c) => c + 1)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'mukti',
          table: 'ar_ceremony_participants',
          filter: `ceremony_id=eq.${ceremonyId}`,
        },
        (payload) => {
          // si left_at vient de passer non-null → décrement ; si repassé à null → incrément
          const prev = payload.old as { left_at: string | null } | null
          const next = payload.new as { left_at: string | null } | null
          const wasActive = prev && prev.left_at === null
          const isActive = next && next.left_at === null
          if (wasActive && !isActive) setParticipantsCount((c) => Math.max(0, c - 1))
          if (!wasActive && isActive) setParticipantsCount((c) => c + 1)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [ceremonyId])

  // Tick local pour recalculer le countdown toutes les 250ms
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 1_000_000), 250)
    return () => window.clearInterval(id)
  }, [])

  // Calcul phase + temps
  const now = Date.now()
  let phase: CeremonyPhase = 'upcoming'
  let secondsUntilStart = 0
  let secondsIntoLive = 0
  let secondsRemaining = 0

  if (ceremony) {
    const scheduledAt = new Date(ceremony.scheduled_at).getTime()
    const duration = ceremony.duration_sec * 1000
    const startedAt = ceremony.started_at ? new Date(ceremony.started_at).getTime() : null

    if (ceremony.status === 'cancelled') {
      phase = 'cancelled'
    } else if (ceremony.status === 'finished') {
      phase = 'finished'
    } else if (ceremony.status === 'live' && startedAt !== null) {
      const liveElapsed = now - startedAt
      secondsIntoLive = Math.max(0, Math.floor(liveElapsed / 1000))
      secondsRemaining = Math.max(0, Math.floor((duration - liveElapsed) / 1000))
      phase = 'live'
    } else {
      const diff = scheduledAt - now
      secondsUntilStart = Math.max(0, Math.floor(diff / 1000))
      phase = diff <= STARTING_WINDOW_SEC * 1000 ? 'starting' : 'upcoming'
    }
  }

  // Suppress unused warning from tick — it's a trigger for re-render only
  void tick

  return {
    ceremony,
    phase,
    secondsUntilStart,
    secondsIntoLive,
    secondsRemaining,
    participantsCount,
    isLoading,
    error,
    refresh,
  }
}

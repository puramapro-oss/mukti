import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Circle, CircleParticipant, CircleRotation } from '@/lib/circles'

interface ParticipantProfile {
  id: string
  full_name: string | null
}

type FetchResponse = {
  ok: boolean
  circle?: Circle
  participants?: CircleParticipant[]
  current_rotation?: CircleRotation | null
  error?: string
}

interface UseCircleStateReturn {
  circle: Circle | null
  participants: CircleParticipant[]
  profiles: Map<string, ParticipantProfile>
  currentRotation: CircleRotation | null
  loading: boolean
  error: string | null
}

export function useCircleState(circleId: string): UseCircleStateReturn {
  const [circle, setCircle] = useState<Circle | null>(null)
  const [participants, setParticipants] = useState<CircleParticipant[]>([])
  const [profiles, setProfiles] = useState<Map<string, ParticipantProfile>>(new Map())
  const [currentRotation, setCurrentRotation] = useState<CircleRotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchState() {
      try {
        const res = await fetch(`/api/circles/${circleId}`, { cache: 'no-store' })
        const data: FetchResponse = await res.json()
        if (cancelled) return
        if (!res.ok || !data.ok || !data.circle) {
          setError(data.error ?? 'Cercle introuvable.')
          setLoading(false)
          return
        }
        setCircle(data.circle)
        setParticipants(data.participants ?? [])
        setCurrentRotation(data.current_rotation ?? null)
        setError(null)

        // Fetch profiles pour affichage noms
        const ids = (data.participants ?? []).map((p) => p.user_id)
        if (ids.length > 0) {
          const supabase = createClient()
          const { data: pr } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', ids)
          if (!cancelled && pr) {
            const map = new Map<string, ParticipantProfile>()
            pr.forEach((p) => map.set(p.id, p as ParticipantProfile))
            setProfiles(map)
          }
        }
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Erreur réseau.')
          setLoading(false)
        }
      }
    }

    fetchState()
    refreshTimerRef.current = setInterval(fetchState, 5000)

    return () => {
      cancelled = true
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [circleId])

  return { circle, participants, profiles, currentRotation, loading, error }
}

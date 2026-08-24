import { useEffect, useState } from 'react'
import type { Circle, CircleParticipant } from '@/lib/circles'

interface UseCircleJoinProps {
  circleId: string
  myUserId: string
  loading: boolean
  circle: Circle | null
  participants: CircleParticipant[]
  onError: (msg: string) => void
  onJoined: () => void
  onMicMuted: (muted: boolean) => void
}

export function useCircleJoin({
  circleId,
  myUserId,
  loading,
  circle,
  participants,
  onError,
  onJoined,
  onMicMuted,
}: UseCircleJoinProps): void {
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (loading || !circle) return
    const me = participants.find((p) => p.user_id === myUserId && !p.left_at)
    if (me) {
      queueMicrotask(() => {
        onJoined()
        onMicMuted(me.mic_muted)
      })
      return
    }
    if (joining) return

    queueMicrotask(() => setJoining(true))
    fetch(`/api/circles/${circleId}/join`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          onError(data.error ?? 'Impossible de rejoindre.')
          setJoining(false)
          return
        }
        onJoined()
        setJoining(false)
      })
      .catch(() => {
        onError('Erreur lors de l\'entrée dans le cercle.')
        setJoining(false)
      })
  }, [loading, circle, participants, myUserId, circleId, joining, onError, onJoined, onMicMuted])
}

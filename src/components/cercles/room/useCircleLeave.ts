import { useEffect } from 'react'

interface UseCircleLeaveProps {
  circleId: string
  hasJoined: boolean
}

export function useCircleLeave({ circleId, hasJoined }: UseCircleLeaveProps): void {
  useEffect(() => {
    async function doLeave() {
      if (!hasJoined) return
      try {
        await fetch(`/api/circles/${circleId}/leave`, {
          method: 'POST',
          keepalive: true,
        })
      } catch {
        /* ignore */
      }
    }
    const handleBeforeUnload = () => {
      // keepalive permet d'envoyer la requête même pendant unload
      void doLeave()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      void doLeave()
    }
  }, [hasJoined, circleId])
}

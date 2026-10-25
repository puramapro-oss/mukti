// MUKTI — G5.4 useNightPlayerVolume
// Hook gérant le ramp volume du NightPlayer : RAF loop + calcul volume adaptif.

import { useEffect, useRef, useState } from 'react'
import { computeRampVolume } from '@/lib/reprogramming-utils'
import { REPROG_NIGHT_VOLUME_RAMP_MIN } from '@/lib/constants'

interface UseNightPlayerVolumeParams {
  running: boolean
  rampEnabled: boolean
  onVolumeChange: (vol: number) => void
  onAutoStop: () => void
}

interface UseNightPlayerVolumeReturn {
  volumePct: number
  elapsedSec: number
  rampProgress: number
  rampRemainingSec: number
}

export function useNightPlayerVolume({
  running,
  rampEnabled,
  onVolumeChange,
  onAutoStop,
}: UseNightPlayerVolumeParams): UseNightPlayerVolumeReturn {
  const [elapsedSec, setElapsedSec] = useState(0)
  const [volumePct, setVolumePct] = useState(0.5)

  const rafRef = useRef<number | null>(null)
  const startTsRef = useRef<number>(0)
  const onAutoStopRef = useRef(onAutoStop)

  // MAJ ref pour éviter stale closure
  useEffect(() => {
    onAutoStopRef.current = onAutoStop
  })

  useEffect(() => {
    if (!running) return
    startTsRef.current = performance.now()

    const tick = () => {
      const elapsed = (performance.now() - startTsRef.current) / 1000
      setElapsedSec(elapsed)

      // Ramp volume ou fixe
      const vol = rampEnabled ? computeRampVolume(elapsed, 0.55) : 0.45
      setVolumePct(vol)
      onVolumeChange(vol)

      // Arrêt auto quand ramp arrive à 0 (sécurité douce)
      if (rampEnabled && elapsed >= REPROG_NIGHT_VOLUME_RAMP_MIN * 60) {
        onAutoStopRef.current()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setElapsedSec(0)
    }
  }, [running, rampEnabled, onVolumeChange])

  const rampRemainingSec = Math.max(0, REPROG_NIGHT_VOLUME_RAMP_MIN * 60 - elapsedSec)
  const rampProgress = Math.min(1, elapsedSec / (REPROG_NIGHT_VOLUME_RAMP_MIN * 60))

  return {
    volumePct,
    elapsedSec,
    rampProgress,
    rampRemainingSec,
  }
}

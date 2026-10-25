// MUKTI — NightPlayer active clock. Callback changes must not restart the session.
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
  running, rampEnabled, onVolumeChange, onAutoStop,
}: UseNightPlayerVolumeParams): UseNightPlayerVolumeReturn {
  const [elapsedSec, setElapsedSec] = useState(0)
  const [volumePct, setVolumePct] = useState(0.5)
  const latest = useRef({ rampEnabled, onVolumeChange, onAutoStop })

  useEffect(() => {
    latest.current = { rampEnabled, onVolumeChange, onAutoStop }
  }, [rampEnabled, onVolumeChange, onAutoStop])

  useEffect(() => {
    if (!running) {
      setElapsedSec(0)
      return
    }
    const startedAt = performance.now()
    let active = true
    let frame: number | null = null

    function tick() {
      frame = null
      if (!active) return
      const elapsed = Math.max(0, (performance.now() - startedAt) / 1000)
      const current = latest.current
      const finished = current.rampEnabled && elapsed >= REPROG_NIGHT_VOLUME_RAMP_MIN * 60
      const volume = current.rampEnabled ? computeRampVolume(elapsed, 0.55) : 0.45
      setElapsedSec(elapsed)
      setVolumePct(volume)
      // Finish before calling external callbacks: a re-entrant callback cannot
      // schedule another frame or trigger completion twice.
      if (finished) active = false
      try {
        current.onVolumeChange(volume)
      } finally {
        if (finished) current.onAutoStop()
      }
      if (active) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      active = false
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [running])

  const limit = REPROG_NIGHT_VOLUME_RAMP_MIN * 60
  return {
    volumePct,
    elapsedSec,
    rampProgress: Math.min(1, elapsedSec / limit),
    rampRemainingSec: Math.max(0, limit - elapsedSec),
  }
}

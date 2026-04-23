'use client'

// MUKTI — G4 AR Engine
// Smoke test page — permet de valider MediaPipe + Three.js sans UI finale.
// Active caméra, lance tracker, affiche debug overlay + compteurs landmarks.

import { useCallback, useRef, useState } from 'react'
import { Camera, CameraOff, Eye } from 'lucide-react'
import { useCameraPermission } from '@/hooks/useCameraPermission'
import ARCanvas from '@/components/ar/ARCanvas'
import type { TrackerFrameResult } from '@/lib/ar/types'

export default function ARTestClient() {
  const cam = useCameraPermission('user')
  const [counters, setCounters] = useState({ pose: 0, hands: 0, fps: 0 })
  const lastFpsUpdate = useRef<number>(0)
  const frameCount = useRef<number>(0)

  const handleFrame = useCallback((frame: TrackerFrameResult) => {
    frameCount.current++
    const now = performance.now()
    const elapsed = now - lastFpsUpdate.current
    if (elapsed > 500) {
      const fps = Math.round((frameCount.current / elapsed) * 1000)
      setCounters({
        pose: frame.pose.landmarks?.length ?? 0,
        hands: frame.hands.hands.length,
        fps,
      })
      frameCount.current = 0
      lastFpsUpdate.current = now
    }
  }, [])

  const gateVisible = cam.status === 'idle' || cam.status === 'denied' || cam.status === 'unavailable' || cam.status === 'imaginary'

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <ARCanvas
          stream={cam.status === 'granted' ? cam.stream : null}
          enabled={cam.status === 'granted'}
          onFrame={handleFrame}
          showDebug
        />
        {gateVisible && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center backdrop-blur-sm">
            {cam.status === 'idle' && (
              <>
                <Camera className="h-10 w-10 text-white/70" />
                <p className="max-w-sm text-sm text-white/80">
                  Autorise l&apos;accès à la caméra pour tester le tracker.
                </p>
                <button
                  type="button"
                  onClick={cam.request}
                  data-testid="ar-test-request"
                  className="rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Autoriser la caméra
                </button>
                <button
                  type="button"
                  onClick={cam.useImaginaryMode}
                  className="text-xs text-white/60 underline-offset-4 hover:underline"
                >
                  Continuer en mode imaginaire
                </button>
              </>
            )}
            {(cam.status === 'denied' || cam.status === 'unavailable') && (
              <>
                <CameraOff className="h-10 w-10 text-white/70" />
                <p className="max-w-sm text-sm text-white/80">{cam.error}</p>
                <button
                  type="button"
                  onClick={cam.useImaginaryMode}
                  className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10"
                >
                  Mode imaginaire
                </button>
              </>
            )}
            {cam.status === 'imaginary' && (
              <>
                <Eye className="h-10 w-10 text-white/70" />
                <p className="max-w-sm text-sm text-white/80">
                  Mode imaginaire actif — la silhouette sera générée (G4.3).
                </p>
                <button
                  type="button"
                  onClick={cam.request}
                  className="text-xs text-white/60 underline-offset-4 hover:underline"
                >
                  Activer la caméra finalement
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {cam.status === 'granted' && (
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/70">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Pose landmarks</p>
            <p className="mt-1 font-mono text-lg text-white">{counters.pose} / 33</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Mains</p>
            <p className="mt-1 font-mono text-lg text-white">{counters.hands} / 2</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">FPS</p>
            <p className="mt-1 font-mono text-lg text-white">{counters.fps}</p>
          </div>
        </div>
      )}
    </div>
  )
}

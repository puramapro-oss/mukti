'use client'

// MUKTI — G4 AR Engine
// Smoke test page — valide MediaPipe + Silhouette + PhantomHands + Calibration.
// Active caméra / mode imaginaire, toggle silhouette/hands/debug/calibration.

import { useCallback, useRef, useState } from 'react'
import { Camera, CameraOff, Eye, Crosshair } from 'lucide-react'
import { useCameraPermission } from '@/hooks/useCameraPermission'
import ARCanvas from '@/components/ar/ARCanvas'
import SilhouetteMesh from '@/components/ar/SilhouetteMesh'
import PhantomHands from '@/components/ar/PhantomHands'
import CalibrationOverlay, { type CalibrationMetrics } from '@/components/ar/CalibrationOverlay'
import type { TrackerFrameResult } from '@/lib/ar/types'

export default function ARTestClient() {
  const cam = useCameraPermission('user')
  const [counters, setCounters] = useState({ pose: 0, hands: 0, fps: 0 })
  const [showSilhouette, setShowSilhouette] = useState(true)
  const [showHands, setShowHands] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [lastCalibration, setLastCalibration] = useState<CalibrationMetrics | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
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

  const handleCalibrationComplete = useCallback(async (metrics: CalibrationMetrics) => {
    setLastCalibration(metrics)
    setCalibrating(false)
    setSaveStatus('saving')
    setSaveMsg(null)
    try {
      const res = await fetch('/api/ar/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setSaveStatus('error')
        setSaveMsg(data.error ?? 'Échec de l\'enregistrement.')
        return
      }
      setSaveStatus('saved')
      setSaveMsg('Calibration enregistrée ✨')
    } catch {
      setSaveStatus('error')
      setSaveMsg('Erreur réseau. Réessaie.')
    }
  }, [])

  const gateVisible = cam.status === 'idle' || cam.status === 'denied' || cam.status === 'unavailable' || cam.status === 'imaginary'

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-black sm:aspect-video">
        <ARCanvas
          stream={cam.status === 'granted' ? cam.stream : null}
          enabled={cam.status === 'granted'}
          onFrame={handleFrame}
          showDebug={showDebug}
          overlay={(frameRef) =>
            calibrating ? (
              <CalibrationOverlay
                frameRef={frameRef}
                onComplete={handleCalibrationComplete}
                onSkip={() => setCalibrating(false)}
              />
            ) : null
          }
        >
          {showSilhouette && <SilhouetteMesh />}
          {showHands && <PhantomHands />}
        </ARCanvas>

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
                  Mode imaginaire actif — la silhouette animée procédurale sera ajoutée en G4.3+.
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
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ToggleBtn active={showSilhouette} onClick={() => setShowSilhouette((s) => !s)}>
              Silhouette
            </ToggleBtn>
            <ToggleBtn active={showHands} onClick={() => setShowHands((s) => !s)}>
              Mains fantômes
            </ToggleBtn>
            <ToggleBtn active={showDebug} onClick={() => setShowDebug((s) => !s)}>
              Debug landmarks
            </ToggleBtn>
            <button
              type="button"
              onClick={() => {
                setCalibrating(true)
                setSaveStatus('idle')
                setSaveMsg(null)
              }}
              data-testid="ar-test-start-calib"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
            >
              <Crosshair className="h-3.5 w-3.5" /> Calibrer
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/70">
            <Stat label="Pose" value={`${counters.pose} / 33`} />
            <Stat label="Mains" value={`${counters.hands} / 2`} />
            <Stat label="FPS" value={String(counters.fps)} />
          </div>

          {lastCalibration && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/70 sm:grid-cols-4">
              <Stat label="Épaules" value={lastCalibration.shoulder_width.toFixed(3)} />
              <Stat label="Torse" value={lastCalibration.torso_length.toFixed(3)} />
              <Stat label="Envergure" value={lastCalibration.arm_span.toFixed(3)} />
              <Stat label="Hanches" value={lastCalibration.hip_width.toFixed(3)} />
            </div>
          )}

          {saveMsg && (
            <div
              role={saveStatus === 'error' ? 'alert' : 'status'}
              className={`rounded-xl border p-3 text-xs ${
                saveStatus === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-200'
                  : saveStatus === 'saved'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-white/5 text-white/70'
              }`}
            >
              {saveMsg}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
        active
          ? 'border-[var(--cyan)]/50 bg-[var(--cyan)]/10 text-white'
          : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-1 font-mono text-lg text-white">{value}</p>
    </div>
  )
}

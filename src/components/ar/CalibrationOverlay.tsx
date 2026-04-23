'use client'

// MUKTI — G4.3 Calibration overlay
// Détecte T-pose (bras en croix) pendant 3s → calcule métrics skeleton → POST /api/ar/calibrate.
// Design : overlay glass centré, instruction claire, progress arc.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { TrackerFrameResult, Landmark } from '@/lib/ar/types'

export interface CalibrationMetrics {
  shoulder_width: number
  torso_length: number
  arm_span: number
  hip_width: number
  calibration_quality: 'low' | 'medium' | 'high'
  calibration_frames: number
}

interface Props {
  frameRef: MutableRefObject<TrackerFrameResult | null>
  onComplete: (metrics: CalibrationMetrics) => void
  onSkip?: () => void
  /** Durée T-pose maintenue avant validation (ms). */
  holdMs?: number
}

type Phase = 'instruction' | 'detecting' | 'holding' | 'completed' | 'error'

const HOLD_MS_DEFAULT = 3000

export default function CalibrationOverlay({ frameRef, onComplete, onSkip, holdMs = HOLD_MS_DEFAULT }: Props) {
  const [phase, setPhase] = useState<Phase>('instruction')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const framesBufferRef = useRef<Landmark[][]>([])
  const holdStartRef = useRef<number | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (phase !== 'detecting' && phase !== 'holding') return

    let raf: number | null = null
    let running = true

    const loop = () => {
      if (!running) return
      const f = frameRef.current
      const pose = f?.pose.landmarks

      if (!pose || pose.length < 33) {
        holdStartRef.current = null
        setProgress(0)
        setPhase('detecting')
        raf = requestAnimationFrame(loop)
        return
      }

      const isT = isTPose(pose)
      if (!isT) {
        holdStartRef.current = null
        framesBufferRef.current = []
        setProgress(0)
        setPhase('detecting')
        raf = requestAnimationFrame(loop)
        return
      }

      const now = performance.now()
      if (holdStartRef.current === null) {
        holdStartRef.current = now
        framesBufferRef.current = []
      }
      const elapsed = now - holdStartRef.current
      const pct = Math.min(1, elapsed / holdMs)
      setProgress(pct)
      setPhase('holding')

      framesBufferRef.current.push(pose)
      if (framesBufferRef.current.length > 120) {
        framesBufferRef.current.shift()
      }

      if (pct >= 1 && !submittedRef.current) {
        submittedRef.current = true
        const metrics = computeMetrics(framesBufferRef.current)
        if (!metrics) {
          setErrorMsg('Calibration incomplète. Reste bien face caméra, bras tendus.')
          setPhase('error')
          submittedRef.current = false
          return
        }
        setPhase('completed')
        onComplete(metrics)
        return
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => {
      running = false
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [phase, frameRef, holdMs, onComplete])

  return (
    <div
      role="dialog"
      aria-labelledby="ar-calib-title"
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6 backdrop-blur"
      data-testid="ar-calibration-overlay"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-2xl">
        <h2 id="ar-calib-title" className="text-lg font-semibold text-white">
          Calibration du miroir
        </h2>
        <p className="text-sm text-white/70">
          Lève les bras <span className="text-white">bien à l&apos;horizontale</span>, paumes ouvertes, face à la caméra.
          Tiens 3 secondes.
        </p>

        <ProgressRing value={progress} status={phase} />

        <p className="min-h-[2.5rem] text-xs text-white/55">
          {phase === 'instruction' && 'Prêt·e ? Clique sur commencer.'}
          {phase === 'detecting' && 'Je te cherche… positionne-toi en croix.'}
          {phase === 'holding' && `Tiens bon… ${Math.ceil((1 - progress) * (holdMs / 1000))}s`}
          {phase === 'completed' && 'Calibré ✨'}
          {phase === 'error' && (errorMsg ?? 'Réessaie doucement.')}
        </p>

        {phase === 'instruction' && (
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setPhase('detecting')
                setProgress(0)
                setErrorMsg(null)
                submittedRef.current = false
              }}
              data-testid="ar-calib-start"
              className="w-full rounded-xl bg-gradient-to-r from-[var(--cyan,#06B6D4)] to-[var(--purple,#7C3AED)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Commencer la calibration
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="text-xs text-white/50 transition-colors hover:text-white/80"
              >
                Plus tard
              </button>
            )}
          </div>
        )}

        {phase === 'error' && (
          <button
            type="button"
            onClick={() => {
              submittedRef.current = false
              holdStartRef.current = null
              setErrorMsg(null)
              setPhase('detecting')
              setProgress(0)
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 transition-colors hover:bg-white/10"
          >
            Réessayer
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// T-pose detection
// Critères (souples, pour accessibilité) :
//   - épaules (11,12) + poignets (15,16) visibility > 0.5
//   - wrist.y proche de shoulder.y (±10% hauteur image)
//   - wrists ouverts sur l'axe x (distance > 0.4 largeur image)
// ---------------------------------------------------------------------------
function isTPose(pose: Landmark[]): boolean {
  const shL = pose[11]
  const shR = pose[12]
  const wrL = pose[15]
  const wrR = pose[16]
  if (!shL || !shR || !wrL || !wrR) return false
  if ((shL.visibility ?? 0) < 0.5 || (shR.visibility ?? 0) < 0.5) return false
  if ((wrL.visibility ?? 0) < 0.5 || (wrR.visibility ?? 0) < 0.5) return false

  const shoulderMidY = (shL.y + shR.y) / 2
  const wristAvgY = (wrL.y + wrR.y) / 2
  const yDelta = Math.abs(wristAvgY - shoulderMidY)
  if (yDelta > 0.1) return false

  const armSpan = Math.abs(wrL.x - wrR.x)
  if (armSpan < 0.4) return false

  return true
}

// ---------------------------------------------------------------------------
// Compute metrics (moyenne sur les frames retenues pour lisser le bruit)
// ---------------------------------------------------------------------------
function computeMetrics(frames: Landmark[][]): CalibrationMetrics | null {
  if (frames.length < 10) return null

  let shoulderW = 0
  let torsoL = 0
  let armSpan = 0
  let hipW = 0
  let kept = 0

  for (const pose of frames) {
    const shL = pose[11]
    const shR = pose[12]
    const wrL = pose[15]
    const wrR = pose[16]
    const hipL = pose[23]
    const hipR = pose[24]
    if (!shL || !shR || !wrL || !wrR || !hipL || !hipR) continue
    shoulderW += Math.abs(shL.x - shR.x)
    const hipMidY = (hipL.y + hipR.y) / 2
    const shoulderMidY = (shL.y + shR.y) / 2
    torsoL += Math.abs(hipMidY - shoulderMidY)
    armSpan += Math.abs(wrL.x - wrR.x)
    hipW += Math.abs(hipL.x - hipR.x)
    kept++
  }

  if (kept < 5) return null

  const shoulder_width = clampMetric(shoulderW / kept, 0.05, 2)
  const torso_length = clampMetric(torsoL / kept, 0.05, 2)
  const arm_span = clampMetric(armSpan / kept, 0.1, 3)
  const hip_width = clampMetric(hipW / kept, 0.05, 2)

  // quality basé sur le nombre de frames retenues
  const quality: 'low' | 'medium' | 'high' = kept >= 90 ? 'high' : kept >= 45 ? 'medium' : 'low'

  return {
    shoulder_width,
    torso_length,
    arm_span,
    hip_width,
    calibration_quality: quality,
    calibration_frames: Math.min(kept, 1000),
  }
}

function clampMetric(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number(v.toFixed(4))))
}

// ---------------------------------------------------------------------------
// ProgressRing visuel — arc circulaire 0→100%
// ---------------------------------------------------------------------------
function ProgressRing({ value, status }: { value: number; status: Phase }) {
  const size = 140
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = circumference * value
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#calib-grad)"
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="calib-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
        {status === 'completed' ? '✓' : `${Math.round(value * 100)}%`}
      </div>
    </div>
  )
}

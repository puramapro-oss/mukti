'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ModeFrame from './ModeFrame'
import { type ModeId } from '@/lib/constants'
import { AURORA_PHASES } from '@/lib/constants/aurora'
import { createAuroraAudio, type AuroraAudioHandle } from '@/lib/aurora-audio'
import { AURORA_MELODY_REFERENCE_HZ } from '@/lib/aurora-melody'
import { loadA11yPrefs, safeVibrate } from '@/lib/accessibility'
import { useAccessibilityPrefs } from '@/hooks/useAccessibilityPrefs'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const MODE_ID: ModeId = 'multisensoriel'
const DURATION = 180
// Reuse the existing AURORA Focus rhythm, with no hold or top-up phase.
const SOFT_BREATH = AURORA_PHASES.focus[2].breath
const BREATH_SECONDS = SOFT_BREATH.in + SOFT_BREATH.out
type Outcome = 'completed' | 'interrupted'
type AudioState = 'off' | 'starting' | 'playing' | 'unavailable' | 'error'

export default function Mode2MultisensorielUltime({ addictionId }: { addictionId: string }) {
  return (
    <ModeFrame modeId={MODE_ID} addictionId={addictionId} durationSec={DURATION}>
      {({ onCompleted }) => <MultisensorielActive onCompleted={onCompleted} />}
    </ModeFrame>
  )
}

function cancelVibration() {
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(0)
  } catch { /* An optional output must not prevent the session from stopping. */ }
}

function releaseHandle(audio: AuroraAudioHandle | null) {
  if (!audio) return
  try { audio.stop() } catch { /* Still attempt disposal independently. */ }
  try { audio.dispose() } catch { /* The interface remains stopped. */ }
}

function MultisensorielActive({ onCompleted }: { onCompleted: (outcome?: Outcome) => void }) {
  const { prefs } = useAccessibilityPrefs()
  const reducedMotion = useReducedMotion()
  const [elapsed, setElapsed] = useState(0)
  const [guided, setGuided] = useState(false)
  const [haptics, setHaptics] = useState(false)
  const [hapticSupported, setHapticSupported] = useState(false)
  const [audioState, setAudioState] = useState<AudioState>('off')
  const audioRef = useRef<AuroraAudioHandle | null>(null)
  const audioGenerationRef = useRef(0)
  const mountedRef = useRef(false)
  const finishedRef = useRef(false)
  const completedRef = useRef(onCompleted)
  const finishRef = useRef<(outcome: Outcome) => void>(() => undefined)

  useEffect(() => { completedRef.current = onCompleted }, [onCompleted])

  const releaseAudio = useCallback(() => {
    audioGenerationRef.current += 1
    const current = audioRef.current
    audioRef.current = null
    releaseHandle(current)
  }, [])

  useEffect(() => {
    if (finishedRef.current) return
    mountedRef.current = true
    let live = true
    let timer: ReturnType<typeof setInterval> | undefined
    const startedAt = performance.now()
    const finish = (outcome: Outcome) => {
      if (!live || finishedRef.current) return
      finishedRef.current = true
      clearInterval(timer)
      releaseAudio()
      cancelVibration()
      completedRef.current(outcome)
    }
    finishRef.current = finish
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') finish('interrupted')
    }
    const onPageHide = () => finish('interrupted')
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    setHapticSupported(typeof navigator.vibrate === 'function')
    if (document.visibilityState !== 'visible') finish('interrupted')
    else {
      timer = setInterval(() => {
        if (!live || finishedRef.current) return
        const seconds = Math.min(DURATION, Math.max(0, Math.floor((performance.now() - startedAt) / 1000)))
        setElapsed(seconds)
        if (seconds >= DURATION) finish('completed')
      }, 250)
    }
    return () => {
      live = false
      mountedRef.current = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      releaseAudio()
      cancelVibration()
    }
  }, [releaseAudio])

  useEffect(() => {
    if (prefs.silentMode) {
      releaseAudio()
      setAudioState('off')
    }
    if (prefs.silentMode || !prefs.hapticEnabled) {
      setHaptics(false)
      cancelVibration()
    }
  }, [prefs.silentMode, prefs.hapticEnabled, releaseAudio])

  const cycleSecond = elapsed % BREATH_SECONDS
  const inspiring = cycleSecond < SOFT_BREATH.in
  const phase = inspiring ? 'Inspire sans forcer' : 'Expire sans forcer'
  const phaseKey = `${Math.floor(elapsed / BREATH_SECONDS)}:${inspiring ? 'in' : 'out'}`
  const progress = inspiring ? cycleSecond / SOFT_BREATH.in : (cycleSecond - SOFT_BREATH.in) / SOFT_BREATH.out
  const scale = inspiring ? 0.9 + 0.2 * progress : 1.1 - 0.2 * progress

  useEffect(() => {
    if (!guided || !haptics || prefs.silentMode || !prefs.hapticEnabled || finishedRef.current) return
    if (!safeVibrate(60)) {
      setHapticSupported(false)
      setHaptics(false)
    }
  }, [guided, haptics, phaseKey, prefs.silentMode, prefs.hapticEnabled])

  const toggleAudio = async () => {
    if (!mountedRef.current || finishedRef.current) return
    if (audioRef.current) {
      releaseAudio()
      setAudioState('off')
      return
    }
    // Read synchronously as well: the preference hook hydrates after mount.
    if (loadA11yPrefs().silentMode || document.visibilityState !== 'visible') return
    const ticket = ++audioGenerationRef.current
    let audio: AuroraAudioHandle | null = null
    const current = () => mountedRef.current && !finishedRef.current && ticket === audioGenerationRef.current
    try {
      audio = createAuroraAudio({ masterGain: 0.2 })
      audioRef.current = audio
      if (!audio.getCapabilities?.().audio || !audio.setRitualMix) {
        releaseAudio()
        setAudioState('unavailable')
        return
      }
      audio.setVoiceGuidance(false)
      audio.setRitualMix({ voice: 0, music: 0, tone: 0.25 })
      audio.setEnabled(true)
      setAudioState('starting')
      await audio.start()
      if (!current() || loadA11yPrefs().silentMode || document.visibilityState !== 'visible') {
        if (current()) {
          releaseAudio()
          setAudioState('off')
          if (document.visibilityState !== 'visible') finishRef.current('interrupted')
        } else releaseHandle(audio)
        return
      }
      setAudioState('playing')
    } catch {
      if (!current()) { releaseHandle(audio); return }
      releaseAudio()
      setAudioState('error')
    }
  }

  const remaining = DURATION - elapsed
  const timeLabel = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  const audioOn = audioState === 'playing' || audioState === 'starting'

  return (
    <section className="flex w-full max-w-lg flex-col items-center gap-6 text-center" aria-label="Pause multisensorielle">
      <div
        aria-hidden="true"
        data-testid="multisensoriel-breath"
        className="flex h-36 w-36 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10"
        style={{ transform: guided && !reducedMotion ? `scale(${scale})` : 'none', transition: reducedMotion ? 'none' : 'transform 1s ease-in-out' }}
      >
        <span className="text-3xl" aria-hidden="true">◌</span>
      </div>
      <div>
        <p className="text-xl font-semibold text-[var(--text-primary)]" role="status" aria-live="polite">
          {guided ? phase : 'Respire librement, à ton rythme'}
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Tu peux arrêter la séance à tout moment.</p>
      </div>
      <p role="timer" aria-label="Temps restant" aria-live="off" className="text-lg text-[var(--text-primary)]">{timeLabel}</p>
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-white/10 p-4 text-left">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={guided} onChange={event => { setGuided(event.target.checked); if (!event.target.checked) cancelVibration() }} />
          Guidage respiratoire doux, sans rétention
        </label>
        {guided && <p className="text-xs text-[var(--text-muted)]">Inspiration {SOFT_BREATH.in} s, expiration {SOFT_BREATH.out} s. Reviens à ton rythme si ce guidage ne te convient pas.</p>}
        <button
          type="button"
          onClick={() => { void toggleAudio() }}
          disabled={prefs.silentMode}
          aria-pressed={audioOn}
          className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
        >
          {audioState === 'starting' ? 'Annuler le démarrage du son' : audioState === 'playing' ? 'Couper le son' : `Activer le son ${AURORA_MELODY_REFERENCE_HZ} Hz`}
        </button>
        {prefs.silentMode && <p className="text-xs text-[var(--text-muted)]">Le mode silencieux est activé dans tes préférences.</p>}
        {audioState === 'unavailable' && <p role="status" className="text-sm">Le son n’est pas disponible ici. La séance reste utilisable en silence.</p>}
        {audioState === 'error' && <p role="alert" className="text-sm">Le son n’a pas démarré. Tu peux réessayer ou continuer en silence.</p>}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={haptics}
            disabled={!guided || !hapticSupported || prefs.silentMode || !prefs.hapticEnabled}
            onChange={event => { setHaptics(event.target.checked); if (!event.target.checked) cancelVibration() }}
          />
          Vibrations pendant le guidage
        </label>
        {!hapticSupported && <p className="text-xs text-[var(--text-muted)]">Vibrations indisponibles dans ce navigateur.</p>}
      </div>
      <button type="button" onClick={() => finishRef.current('interrupted')} className="min-h-11 rounded-xl border border-white/20 px-6 py-3 text-sm">
        Arrêter la séance
      </button>
    </section>
  )
}

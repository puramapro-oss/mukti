'use client'

import { useEffect, useRef, useState } from 'react'
import ModeFrame from './ModeFrame'
import { type ModeId } from '@/lib/constants'
import { AURORA_PHASES } from '@/lib/constants/aurora'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const MODE_ID: ModeId = 'micro_meditation'
const DURATION = 30
const SOFT_BREATH = AURORA_PHASES.ignite[2].breath
const BREATH_SECONDS = SOFT_BREATH.in + SOFT_BREATH.out
type Outcome = 'completed' | 'interrupted'

interface Props {
  addictionId: string
  affirmation: string | null
}

export default function Mode3MicroMeditation({ addictionId, affirmation }: Props) {
  return (
    <ModeFrame modeId={MODE_ID} addictionId={addictionId} durationSec={DURATION}>
      {({ onCompleted }) => <MicroMeditationActive affirmation={affirmation} onCompleted={onCompleted} />}
    </ModeFrame>
  )
}

function MicroMeditationActive({
  affirmation,
  onCompleted,
}: {
  affirmation: string | null
  onCompleted: (outcome?: Outcome) => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [guided, setGuided] = useState(false)
  const reducedMotion = useReducedMotion()
  const completedRef = useRef(onCompleted)
  const finishedRef = useRef(false)
  const finishRef = useRef<(outcome: Outcome) => void>(() => undefined)

  useEffect(() => { completedRef.current = onCompleted }, [onCompleted])

  useEffect(() => {
    if (finishedRef.current) return
    let live = true
    let timer: ReturnType<typeof setInterval> | undefined
    const startedAt = performance.now()
    const finish = (outcome: Outcome) => {
      if (!live || finishedRef.current) return
      finishedRef.current = true
      clearInterval(timer)
      completedRef.current(outcome)
    }
    finishRef.current = finish
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') finish('interrupted')
    }
    const onPageHide = () => finish('interrupted')
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
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
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  const cycleSecond = elapsed % BREATH_SECONDS
  const inspiring = cycleSecond < SOFT_BREATH.in
  const progress = inspiring ? cycleSecond / SOFT_BREATH.in : (cycleSecond - SOFT_BREATH.in) / SOFT_BREATH.out
  const scale = inspiring ? 0.9 + 0.2 * progress : 1.1 - 0.2 * progress
  const message = affirmation?.trim() || 'Tu peux faire une pause, à ton rythme.'

  return (
    <section className="flex w-full max-w-md flex-col items-center gap-6 text-center" aria-label="Micro-méditation">
      <div
        aria-hidden="true"
        data-testid="micro-meditation-breath"
        className="h-36 w-36 rounded-full border border-cyan-300/30 bg-cyan-500/10"
        style={{ transform: guided && !reducedMotion ? `scale(${scale})` : 'none', transition: reducedMotion ? 'none' : 'transform 1s ease-in-out' }}
      />
      <p className="text-sm text-[var(--text-primary)]" role="status" aria-live="polite">
        {guided ? (inspiring ? 'Inspire sans forcer' : 'Expire sans forcer') : 'Respire librement, à ton rythme'}
      </p>
      <div>
        <p className="text-xs uppercase tracking-widest text-[var(--cyan)]">Affirmation du moment</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-2xl leading-relaxed text-[var(--text-primary)]">« {message} »</p>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={guided} onChange={event => setGuided(event.target.checked)} />
        Guidage respiratoire doux, sans rétention
      </label>
      {guided && <p className="text-xs text-[var(--text-muted)]">Inspiration {SOFT_BREATH.in} s, expiration {SOFT_BREATH.out} s. Reviens à ton rythme si ce guidage ne te convient pas.</p>}
      <p role="timer" aria-label="Temps restant" aria-live="off" className="text-sm text-[var(--text-muted)]">{DURATION - elapsed} s restantes</p>
      <button type="button" onClick={() => finishRef.current('interrupted')} className="min-h-11 rounded-xl border border-white/20 px-6 py-3 text-sm">
        Arrêter la séance
      </button>
    </section>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { type ModeId, MODES_G2 } from '@/lib/constants'
import { wellbeingRequest } from '@/lib/wellbeing-request'

type Outcome = 'resisted' | 'relapsed' | 'interrupted' | 'completed'
type Stage = 'entry' | 'active' | 'exit'
interface Props {
  modeId: ModeId
  addictionId: string
  children: (ctx: { onCompleted: (outcome?: Outcome) => void }) => ReactNode
  durationSec?: number
}
interface Completion {
  started_at: string
  completed_at: string
  duration_sec: number
  outcome: Outcome
}
interface SavePayload extends Completion {
  client_session_id: string
  mode: ModeId
  addiction_id: string
  urge_before?: number
  urge_after?: number
}

function sessionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Some browsers expose getRandomValues outside the contexts supporting randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function confirmsSession(value: unknown, payload: SavePayload): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return row.id === payload.client_session_id && row.mode === payload.mode
    && row.addiction_id === payload.addiction_id.toLowerCase()
    && row.outcome === payload.outcome && row.duration_sec === payload.duration_sec
    && row.urge_before === (payload.urge_before ?? null) && row.urge_after === (payload.urge_after ?? null)
    && typeof row.started_at === 'string' && Date.parse(row.started_at) === Date.parse(payload.started_at)
    && typeof row.completed_at === 'string' && Date.parse(row.completed_at) === Date.parse(payload.completed_at)
}

export default function ModeFrame(props: Props) {
  // A changed target is a new frame. Old replies and callbacks cannot affect it.
  return <ModeSessionFrame key={`${props.modeId}:${props.addictionId}`} {...props} />
}

function ModeSessionFrame({ modeId, addictionId, children, durationSec }: Props) {
  const router = useRouter()
  // A direct link may have no previous history entry. Return to a known local
  // destination, with an invalid route parameter falling back to the list.
  const returnPath = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(addictionId)
    ? `/dashboard/liberation/${addictionId.toLowerCase()}`
    : '/dashboard/liberation'
  const meta = MODES_G2.find(mode => mode.id === modeId)!
  const [stage, setStage] = useState<Stage>('entry')
  const [urgeBefore, setUrgeBefore] = useState<number | null>(null)
  const [urgeAfter, setUrgeAfter] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stageRef = useRef<Stage>('entry')
  const startedAt = useRef(0)
  const startedMonotonic = useRef(0)
  const completion = useRef<Completion | null>(null)
  const payload = useRef<SavePayload | null>(null)
  const request = useRef<AbortController | null>(null)
  const attempt = useRef(0)
  const mounted = useRef(false)
  const leaving = useRef(false)

  useEffect(() => {
    mounted.current = true
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      mounted.current = false
      attempt.current += 1
      request.current?.abort()
      request.current = null
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const leave = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    attempt.current += 1
    request.current?.abort()
    request.current = null
    router.replace(returnPath)
  }, [router, returnPath])

  const startActive = () => {
    if (stageRef.current !== 'entry' || leaving.current) return
    startedAt.current = Date.now()
    startedMonotonic.current = performance.now()
    stageRef.current = 'active'
    setStage('active')
  }

  const finishMode = useCallback((outcome: Outcome = 'completed') => {
    if (!mounted.current || leaving.current || stageRef.current !== 'active') return
    const endedAt = Date.now()
    completion.current = {
      started_at: new Date(startedAt.current).toISOString(),
      completed_at: new Date(endedAt).toISOString(),
      duration_sec: Math.max(0, Math.round((performance.now() - startedMonotonic.current) / 1000)),
      outcome,
    }
    stageRef.current = 'exit'
    setStage('exit')
  }, [])

  const submitLog = async () => {
    if (request.current || leaving.current || stageRef.current !== 'exit' || !completion.current) return
    try {
      payload.current ??= Object.freeze({
        ...completion.current, client_session_id: sessionId(), mode: modeId, addiction_id: addictionId,
        urge_before: urgeBefore ?? undefined, urge_after: urgeAfter ?? undefined,
      })
    } catch {
      setError('Enregistrement indisponible sur ce navigateur. Tes réponses restent affichées dans cette page.')
      return
    }
    const sent = payload.current
    const current = ++attempt.current
    const controller = new AbortController()
    request.current = controller // Synchronous guard, before React commits disabled controls.
    setLocked(true)
    setSubmitting(true)
    setError(null)
    const isCurrent = () => mounted.current && !leaving.current && current === attempt.current
    try {
      const result = await wellbeingRequest<Record<string, unknown>>('/api/mode-sessions/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sent),
      }, controller.signal)
      if (!isCurrent()) return
      if (!confirmsSession(result.session, sent)) throw new Error('Confirmation de séance invalide.')
      toast.success('Session enregistrée.')
      leave()
    } catch {
      if (isCurrent()) setError('Enregistrement non confirmé. Tes réponses restent affichées ici ; tu peux réessayer.')
    } finally {
      if (isCurrent()) {
        request.current = null
        setSubmitting(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#05050a]" role="dialog" aria-modal="true" aria-label={`Mode ${meta.name}`}>
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>{meta.emoji}</span>
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Mode</p>
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">{meta.name}</h1>
          </div>
        </div>
        <button type="button" onClick={stage === 'active' ? () => finishMode('interrupted') : leave}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-[var(--text-secondary)] motion-safe:transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
          aria-label="Quitter le mode" data-testid="mode-close"><X className="h-5 w-5" /></button>
      </header>
      <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6">
        {stage === 'entry' && <div className="my-auto flex w-full max-w-md flex-col items-center gap-8 text-center">
          <p className="text-sm uppercase tracking-widest text-[var(--text-muted)]">Avant de commencer</p>
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Où en es-tu de l&apos;envie, là tout de suite&nbsp;?</h2>
          <UrgeScale value={urgeBefore} onChange={setUrgeBefore} testIdPrefix="urge-before" />
          <button type="button" onClick={startActive} disabled={urgeBefore === null}
            className="w-full rounded-2xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-4 text-base font-medium text-white disabled:opacity-40 enabled:hover:opacity-90" data-testid="mode-start">
            Commencer {durationSec ? `(${durationSec}s)` : ''}
          </button>
          <button type="button" onClick={leave} className="text-sm text-[var(--text-muted)]">Finalement pas maintenant</button>
        </div>}
        {stage === 'active' && <div className="flex w-full flex-1 flex-col items-center justify-center">
          {children({ onCompleted: finishMode })}
        </div>}
        {stage === 'exit' && <div className="my-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-[var(--accent,#10B981)]" aria-hidden />
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Et maintenant&nbsp;?</h2>
          <p className="text-sm text-[var(--text-secondary)]">Prends un instant. Comment est l&apos;envie après cette session&nbsp;?</p>
          <UrgeScale value={urgeAfter} onChange={setUrgeAfter} testIdPrefix="urge-after" disabled={locked} />
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {locked && <p className="text-sm text-[var(--text-secondary)]">
            Réessayer renvoie les mêmes réponses. Elles restent affichées tant que cette page reste ouverte.
            Quitter ne garantit pas l&apos;annulation d&apos;une demande déjà envoyée.
          </p>}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => { void submitLog() }} disabled={submitting}
              className="flex-1 rounded-2xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60" data-testid="mode-submit">
              {submitting ? 'Enregistrement…' : locked ? 'Réessayer l’enregistrement' : 'Valider la session'}
            </button>
            <button type="button" onClick={leave} className="flex-1 rounded-2xl border border-[var(--border)] bg-white/5 px-6 py-3 text-sm text-[var(--text-secondary)]">
              {locked ? 'Quitter cette page' : 'Sortir sans enregistrer'}
            </button>
          </div>
        </div>}
      </main>
    </div>
  )
}

function UrgeScale({ value, onChange, testIdPrefix, disabled = false }: {
  value: number | null
  onChange: (value: number) => void
  testIdPrefix: string
  disabled?: boolean
}) {
  return <div className="flex w-full flex-col gap-2">
    <div className="flex items-baseline justify-between text-xs text-[var(--text-muted)]">
      <span>Calme</span><span className="text-2xl font-semibold text-[var(--cyan)]">{value ?? '—'}/10</span><span>Intense</span>
    </div>
    <div className="grid grid-cols-5 gap-1 sm:grid-cols-10" role="radiogroup" aria-label="Intensité de l'envie de 1 à 10">
      {Array.from({ length: 10 }, (_, index) => index + 1).map(number => <button key={number}
        type="button" role="radio" aria-checked={value === number} disabled={disabled} onClick={() => onChange(number)}
        className={`min-h-11 min-w-0 rounded-md border text-sm disabled:cursor-default ${value === number
          ? 'border-[var(--cyan)] bg-[var(--cyan)]/25 text-[var(--cyan)]'
          : 'border-[var(--border)] bg-white/5 text-[var(--text-muted)] enabled:hover:border-[var(--border-glow)]'}`}
        data-testid={`${testIdPrefix}-${number}`}>{number}</button>)}
    </div>
  </div>
}

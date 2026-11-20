'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FeedbackSession } from '@/lib/wellbeing'
import type { FeedbackValues } from '@/lib/wellbeing-state'
import { AURORA_VARIANTS } from '@/lib/constants/aurora'
import { wellbeingRequest } from '@/lib/wellbeing-request'

type Feed = { sessions: FeedbackSession[]; paused_variants: string[] }
const feelings = [['better', 'Mieux'], ['same', 'Pareil'], ['worse', 'Moins bien'], ['unsure', 'Je ne sais pas']] as const
const isDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isVariant = (value: unknown) => AURORA_VARIANTS.some(variant => variant.id === value)

function validFeed(value: unknown): value is Feed {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  if (!Array.isArray(data.sessions) || !Array.isArray(data.paused_variants)
    || !data.paused_variants.every(isVariant)) return false
  return data.sessions.every(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const row = value as Record<string, unknown>
    return typeof row.id === 'string' && row.id.length > 0 && isVariant(row.variant)
      && isDate(row.completed_at) && isDate(row.later_available_at) && Array.isArray(row.feedback)
      && row.feedback.every(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false
        const entry = value as Record<string, unknown>
        return ['immediate', 'later'].includes(String(entry.stage))
          && feelings.some(([feeling]) => feeling === entry.feeling)
          && typeof entry.discomfort === 'boolean' && isDate(entry.created_at)
      })
  })
}

function FeedbackForm({ session, stage, busy, onSave }: {
  session: FeedbackSession
  stage: FeedbackValues['stage']
  busy: boolean
  onSave: (values: FeedbackValues) => Promise<boolean>
}) {
  const [feeling, setFeeling] = useState<FeedbackValues['feeling']>('unsure')
  const [discomfort, setDiscomfort] = useState(false)
  const [consent, setConsent] = useState(false)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  return <form className="mt-4 space-y-3" onSubmit={async event => {
    event.preventDefault()
    if (busy || !consent) return
    const saved = await onSave({ session_id: session.id, stage, feeling, discomfort, consent: true })
    if (saved && alive.current) { setConsent(false); setDiscomfort(false); setFeeling('unsure') }
  }}>
    <p className="text-sm">{session.variant} · {new Date(session.completed_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris) · {stage === 'immediate' ? 'retour à proximité de la séance' : 'retour ultérieur'}</p>
    <fieldset disabled={busy} className="flex flex-wrap gap-3">
      <legend className="mb-2 text-sm">Comment te sens-tu maintenant ?</legend>
      {feelings.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm"><input type="radio" name={'feeling-' + session.id + '-' + stage} value={value} checked={feeling === value} onChange={() => setFeeling(value)} />{label}</label>)}
    </fieldset>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={discomfort} disabled={busy} onChange={event => setDiscomfort(event.target.checked)} />J’ai ressenti un inconfort</label>
    <label className="flex gap-2 text-sm text-white/65"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />J’accepte d’enregistrer ce retour pour adapter mes suggestions. Je peux l’effacer ci-dessous.</label>
    <button disabled={busy || !consent} className="rounded-lg bg-violet-700 px-4 py-2 text-sm disabled:opacity-40">{busy ? 'En cours…' : 'Enregistrer mon retour'}</button>
  </form>
}

export default function WellbeingFeedback({ sessionId }: { sessionId?: string }) {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [clock, setClock] = useState(() => Date.now())
  const [formRevision, setFormRevision] = useState(0)
  const busyRef = useRef(false)
  const alive = useRef(false)
  const loadRef = useRef<AbortController | null>(null)
  const writeRef = useRef<AbortController | null>(null)

  const reload = useCallback(async (afterMutation = false) => {
    if (busyRef.current && !afterMutation) return
    setClock(Date.now())
    loadRef.current?.abort()
    const controller = new AbortController()
    loadRef.current = controller
    try {
      const data = await wellbeingRequest<unknown>('/api/wellbeing/feedback', {}, controller.signal)
      if (!validFeed(data)) throw new Error('Retours indisponibles. Réessaie.')
      if (alive.current && loadRef.current === controller && !controller.signal.aborted) {
        setFeed(data); setError('')
      }
    } catch {
      if (alive.current && loadRef.current === controller && !controller.signal.aborted) {
        setError('Retours indisponibles. Réessaie.')
      }
    }
  }, [])

  useEffect(() => {
    alive.current = true
    busyRef.current = false
    setBusy(false); setFeed(null); setMessage(''); setError('')
    void reload()
    const refresh = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('wellbeing-changed', refresh)
    const timer = setInterval(refresh, 60_000)
    return () => {
      alive.current = false
      loadRef.current?.abort()
      writeRef.current?.abort()
      writeRef.current = null
      busyRef.current = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('wellbeing-changed', refresh)
    }
  }, [reload, sessionId])

  const rows = (feed?.sessions ?? []).filter(row => !sessionId || row.id === sessionId)
  const pending = rows.find(row => {
    const stage = clock < new Date(row.later_available_at).getTime() ? 'immediate' : 'later'
    return !row.feedback.some(entry => entry.stage === stage)
  })
  const stage = pending && clock < new Date(pending.later_available_at).getTime() ? 'immediate' : 'later'

  async function act(operation: (signal: AbortSignal) => Promise<unknown>, success: string): Promise<boolean> {
    if (busyRef.current) return false
    busyRef.current = true
    setBusy(true); setError(''); setMessage('')
    loadRef.current?.abort()
    const controller = new AbortController()
    writeRef.current = controller
    try {
      await operation(controller.signal)
      if (!alive.current || writeRef.current !== controller || controller.signal.aborted) return false
      setMessage(success)
      setFormRevision(value => value + 1)
      await reload(true)
      if (!alive.current || writeRef.current !== controller || controller.signal.aborted) return false
      window.dispatchEvent(new Event('wellbeing-changed'))
      return true
    } catch (cause) {
      if (alive.current && writeRef.current === controller && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Enregistrement non confirmé.')
      }
      return false
    } finally {
      if (writeRef.current === controller) {
        writeRef.current = null
        busyRef.current = false
        if (alive.current) setBusy(false)
      }
    }
  }

  return <section aria-label="Retour facultatif sur mes séances" className="rounded-2xl border border-white/15 bg-[#101019] p-5 text-white">
    <h2 className="text-lg font-medium">Comment cela s’est passé pour toi ?</h2>
    <p className="mt-2 text-sm text-white/65">Réponse facultative, sans conséquence sur tes acquis. Un ressenti moins bon ou un inconfort met la variante en pause dans les suggestions, sans conclure que la séance en est la cause.</p>
    {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-200">{message}</p>}
    {pending && <FeedbackForm
      key={pending.id + ':' + stage + ':' + formRevision}
      session={pending} stage={stage} busy={busy}
      onSave={values => act(signal => wellbeingRequest('/api/wellbeing/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      }, signal), 'Retour enregistré.')}
    />}
    {feed && !pending && <p className="mt-3 text-sm text-white/60">Aucun retour à renseigner pour le moment. Sans réponse, ton ressenti reste inconnu.</p>}
    <p className="mt-3 text-xs text-white/50">Le retour ultérieur devient disponible après quatre heures, à ton initiative. Ce délai organise le formulaire ; il ne mesure pas un effet thérapeutique.</p>
    {feed && feed.paused_variants.length > 0 && <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
      <p className="text-sm">Variantes retirées des suggestions :</p>
      {feed.paused_variants.map(variant => <div key={variant} className="flex flex-wrap items-center gap-3 text-sm"><span>{variant}</span><button disabled={busy} className="underline" onClick={() => void act(signal => wellbeingRequest('/api/wellbeing/feedback', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variant, resume: true }),
      }, signal), 'Suggestions réactivées à ta demande.')}>Je choisis de réactiver les suggestions</button></div>)}
    </div>}
    {rows.some(row => row.feedback.length > 0) && <details className="mt-4 text-sm text-white/65"><summary>Mes retours récents</summary><ul className="mt-2 space-y-2">{rows.flatMap(row => row.feedback.map(entry => <li key={row.id + '-' + entry.stage}>{row.variant} · {entry.stage === 'immediate' ? 'à proximité' : 'plus tard'} : {feelings.find(([value]) => value === entry.feeling)?.[1]}{entry.discomfort ? ' · inconfort signalé' : ''}</li>))}</ul></details>}
    <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/60">
      <button disabled={busy} className="underline" onClick={() => void reload()}>Actualiser</button>
      <button disabled={busy} className="underline" onClick={() => {
        if (busyRef.current) return
        if (window.confirm('Effacer tous mes retours ? Les pauses de suggestions resteront actives jusqu’à mon choix de les réactiver.')) {
          void act(signal => wellbeingRequest('/api/wellbeing/feedback', { method: 'DELETE' }, signal), 'Retours effacés. Les pauses de suggestions sont conservées.')
        }
      }}>Effacer mes retours</button>
    </div>
  </section>
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AURORA_VARIANTS } from '@/lib/constants/aurora'
import { availableAuroraVariants, type WellbeingContext, type WellbeingValues } from '@/lib/wellbeing-state'
import { DEFAULT_WELLBEING_TIME_ZONE, localDay } from '@/lib/wellbeing-date'
import { wellbeingRequest } from '@/lib/wellbeing-request'

const domains = [['physical', 'Énergie physique'], ['cognitive', 'Attention'], ['sensory', 'Confort sensoriel'], ['social', 'Disponibilité sociale']] as const
const defaults = { physical: 'limited', cognitive: 'limited', sensory: 'limited', social: 'limited', minutes: 5 } as const
const control = 'mt-1 w-full rounded-lg border border-white/20 bg-[#181821] p-2 text-sm text-white'
type ContextReply = { context: WellbeingContext | null; day: string; time_zone: string }
type FormValues = Omit<WellbeingValues, 'consent' | 'time_zone'>

function formValues(context: WellbeingContext | null): FormValues {
  return context ? {
    physical: context.physical, cognitive: context.cognitive,
    sensory: context.sensory, social: context.social, minutes: context.minutes,
  } : { ...defaults }
}

function validContextReply(value: unknown): value is ContextReply {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  if (typeof data.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.day)
    || data.time_zone !== DEFAULT_WELLBEING_TIME_ZONE) return false
  if (data.context === null) return true
  if (!data.context || typeof data.context !== 'object' || Array.isArray(data.context)) return false
  const context = data.context as Record<string, unknown>
  return domains.every(([key]) => ['available', 'limited', 'rest'].includes(String(context[key])))
    && typeof context.minutes === 'number' && Number.isInteger(context.minutes) && context.minutes >= 0 && context.minutes <= 120
    && context.day === data.day && typeof context.time_zone === 'string'
    && typeof context.updated_at === 'string' && Number.isFinite(Date.parse(context.updated_at))
}

function validPauseReply(value: unknown): value is { paused_variants: string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  return Array.isArray(data.paused_variants)
    && data.paused_variants.every(value => AURORA_VARIANTS.some(variant => variant.id === value))
}

export default function WellbeingCheckin() {
  const [context, setContext] = useState<WellbeingContext | null>(null)
  const [values, setValues] = useState<FormValues>({ ...defaults })
  const [day, setDay] = useState('')
  const [consent, setConsent] = useState(false)
  const [paused, setPaused] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const busyRef = useRef(false)
  const valuesRef = useRef<FormValues>({ ...defaults })
  const dayRef = useRef('')
  const consentDayRef = useRef<string | null>(null)
  const alive = useRef(false)
  const loadRef = useRef<AbortController | null>(null)
  const writeRef = useRef<AbortController | null>(null)

  const replaceDraft = useCallback((next: FormValues) => {
    valuesRef.current = next
    setValues(next)
  }, [])
  const acceptDay = useCallback((nextDay: string) => {
    if ((dayRef.current && dayRef.current !== nextDay)
      || (consentDayRef.current && consentDayRef.current !== nextDay)) {
      consentDayRef.current = null
      setConsent(false)
      if (dirtyRef.current) setMessage('La journée a changé. Vérifie tes choix puis confirme à nouveau.')
    }
    dayRef.current = nextDay
    setDay(nextDay)
  }, [])

  const reload = useCallback(async () => {
    if (busyRef.current) return
    loadRef.current?.abort()
    const controller = new AbortController()
    loadRef.current = controller
    try {
      const [data, feedback] = await Promise.all([
        wellbeingRequest<unknown>('/api/wellbeing/context', {}, controller.signal),
        wellbeingRequest<unknown>('/api/wellbeing/feedback', {}, controller.signal),
      ])
      if (!validContextReply(data) || !validPauseReply(feedback)) throw new Error('Réponse incomplète.')
      if (!alive.current || loadRef.current !== controller || controller.signal.aborted) return
      setContext(data.context)
      acceptDay(data.day)
      setPaused(feedback.paused_variants)
      setError('')
      if (!dirtyRef.current) {
        const next = formValues(data.context)
        if (JSON.stringify(next) !== JSON.stringify(valuesRef.current)) {
          consentDayRef.current = null
          setConsent(false)
        }
        replaceDraft(next)
      }
    } catch {
      if (alive.current && loadRef.current === controller && !controller.signal.aborted) {
        setPaused(null)
        setError('Lecture indisponible. Les suggestions attendent la synchronisation.')
      }
    }
  }, [acceptDay, replaceDraft])

  useEffect(() => {
    alive.current = true
    void reload()
    const refresh = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('wellbeing-changed', refresh)
    const timer = setInterval(() => {
      if (dayRef.current && dayRef.current !== localDay(new Date(), DEFAULT_WELLBEING_TIME_ZONE)) void reload()
    }, 60_000)
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
  }, [reload])

  function change<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    dirtyRef.current = true
    setDirty(true)
    replaceDraft({ ...valuesRef.current, [key]: value })
    setMessage('')
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busyRef.current || !consent) return
    if (consentDayRef.current !== localDay(new Date(), DEFAULT_WELLBEING_TIME_ZONE)) {
      consentDayRef.current = null
      setConsent(false)
      setMessage('La journée a changé. Vérifie tes choix puis confirme à nouveau.')
      void reload()
      return
    }
    busyRef.current = true
    setBusy(true); setError(''); setMessage('')
    loadRef.current?.abort()
    const controller = new AbortController()
    writeRef.current = controller
    let saved = false
    try {
      const data = await wellbeingRequest<unknown>('/api/wellbeing/context', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valuesRef.current, time_zone: DEFAULT_WELLBEING_TIME_ZONE, consent: true }),
      }, controller.signal)
      if (!validContextReply(data) || !data.context) throw new Error('Enregistrement non confirmé. Tes choix restent affichés pour réessayer.')
      if (!alive.current || writeRef.current !== controller || controller.signal.aborted) return
      dirtyRef.current = false; setDirty(false)
      setContext(data.context); acceptDay(data.day); replaceDraft(formValues(data.context))
      consentDayRef.current = null; setConsent(false)
      setMessage('Tes choix du jour sont enregistrés et partagés entre ces parcours.')
      saved = true
    } catch (cause) {
      if (alive.current && writeRef.current === controller && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Enregistrement non confirmé.')
      }
    } finally {
      if (writeRef.current === controller) {
        writeRef.current = null
        busyRef.current = false
        if (alive.current) {
          setBusy(false)
          if (saved) window.dispatchEvent(new Event('wellbeing-changed'))
        }
      }
    }
  }

  async function remove() {
    if (busyRef.current || !window.confirm('Effacer toutes mes disponibilités enregistrées ?')) return
    busyRef.current = true
    setBusy(true); setError(''); setMessage('')
    loadRef.current?.abort()
    const controller = new AbortController()
    writeRef.current = controller
    let removed = false
    try {
      await wellbeingRequest('/api/wellbeing/context', { method: 'DELETE' }, controller.signal)
      if (!alive.current || writeRef.current !== controller || controller.signal.aborted) return
      setContext(null); dirtyRef.current = false; setDirty(false)
      consentDayRef.current = null; setConsent(false)
      replaceDraft({ ...defaults }); setMessage('Disponibilités effacées.')
      removed = true
    } catch (cause) {
      if (alive.current && writeRef.current === controller && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Suppression non confirmée.')
      }
    } finally {
      if (writeRef.current === controller) {
        writeRef.current = null
        busyRef.current = false
        if (alive.current) {
          setBusy(false)
          if (removed) window.dispatchEvent(new Event('wellbeing-changed'))
        }
      }
    }
  }

  const fresh = context && context.day === localDay(new Date(), DEFAULT_WELLBEING_TIME_ZONE)
  const suggestions = !dirty && fresh && paused ? availableAuroraVariants(context, paused) : []
  return (
    <section aria-label="Ma disponibilité du jour" className="rounded-2xl border border-white/15 bg-white/[0.03] p-5 text-white">
      <h2 className="text-xl font-medium">Ma disponibilité du jour</h2>
      <p className="mt-2 text-sm text-white/70">Quelques choix facultatifs pour adapter les propositions. Tu peux choisir le repos, ignorer ce formulaire ou modifier ta réponse.</p>
      <p className="mt-1 text-xs text-white/50">Journée {day || 'en cours de chargement'} · {DEFAULT_WELLBEING_TIME_ZONE}. Ces réponses décrivent ton ressenti, sans mesure de santé.</p>
      <form onSubmit={save} className="mt-4 space-y-4">
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Mes choix</legend>
          {domains.map(([key, label]) => <label key={key} className="text-sm">{label}
            <select className={control} value={values[key]} onChange={(event) => change(key, event.target.value as typeof values[typeof key])}>
              <option value="available">Disponible</option><option value="limited">Limitée</option><option value="rest">Besoin de repos</option>
            </select>
          </label>)}
          <label className="text-sm">Temps que je souhaite consacrer (minutes)
            <input className={control} type="number" min="0" max="120" required value={values.minutes} onChange={(event) => change('minutes', event.target.valueAsNumber)} />
          </label>
        </fieldset>
        <label className="flex items-start gap-2 text-sm text-white/70">
          <input type="checkbox" checked={consent} disabled={busy} onChange={(event) => {
            consentDayRef.current = event.target.checked ? dayRef.current || localDay(new Date(), DEFAULT_WELLBEING_TIME_ZONE) : null
            setConsent(event.target.checked)
          }} className="mt-1" />
          J’accepte d’enregistrer ces réponses pour adapter mes parcours AURORA et rituel minimaliste. Je peux les effacer ici.
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy || !consent} className="rounded-lg bg-violet-700 px-4 py-2 text-sm disabled:opacity-40">{busy ? 'En cours…' : 'Enregistrer mes choix'}</button>
          <button type="button" disabled={busy} onClick={() => void reload()} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Actualiser</button>
          <button type="button" disabled={busy} onClick={() => void remove()} className="px-2 py-2 text-sm text-white/60 underline">Effacer mes disponibilités</button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-200">{message}</p>}
      {dirty && <p className="mt-3 text-sm text-white/60">Modifications non enregistrées.</p>}
      {!dirty && fresh && paused && <div className="mt-4 border-t border-white/10 pt-3 text-sm text-white/70">
        {suggestions.length > 0 ? <>
          <p>Dans le temps que tu as choisi :</p>
          <div className="mt-2 flex flex-wrap gap-2">{suggestions.map((id) => <Link key={id} className="rounded-lg border border-white/20 px-3 py-2 underline" href={`/dashboard/aurora/${id}`}>{AURORA_VARIANTS.find((v) => v.id === id)?.name}</Link>)}</div>
        </> : <p>Aucune séance suggérée avec tes choix actuels. Une pause reste une possibilité complète.</p>}
        {context.sensory !== 'available' && <p className="mt-2">Pour le confort sensoriel : garde la voix désactivée et masque les particules avant de commencer.</p>}
        {context.social === 'rest' && <p className="mt-2">Tu peux rester dans un parcours individuel, sans interaction sociale.</p>}
        <p className="mt-2 text-xs text-white/50">Le temps et tes choix guident cette liste. Une séance n’est jamais lancée automatiquement.</p>
      </div>}
    </section>
  )
}

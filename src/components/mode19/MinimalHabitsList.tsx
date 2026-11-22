'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, Moon } from 'lucide-react'
import { MINIMAL_RITUAL_HABITS, type MinimalRitualHabit } from '@/lib/constants/core-events'
import {
  MINIMAL_RITUAL_ADAPTED_PROMPTS,
  MINIMAL_RITUAL_MODE_OPTIONS,
  MINIMAL_RITUAL_REST_PROMPT,
  isMinimalRitualParticipationMode,
  type MinimalRitualParticipationMode,
} from '@/lib/constants/minimal-ritual'
import { DEFAULT_WELLBEING_TIME_ZONE, localDay } from '@/lib/wellbeing-date'
import type { HabitStatus, MinimalRitualToday } from '@/lib/minimal-ritual'

interface Props {
  initialStatus: HabitStatus[]
  initialDay: string
  timeZone?: string
  initialError?: string | null
}

class RitualRequestError extends Error {}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function snapshotValue(value: unknown, timeZone: string): MinimalRitualToday | null {
  const json = objectValue(value)
  if (!json || typeof json.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(json.day)
    || json.time_zone !== timeZone || !Array.isArray(json.habits)
    || json.habits.length !== MINIMAL_RITUAL_HABITS.length) return null
  const seen = new Set<string>()
  for (const value of json.habits) {
    const row = objectValue(value)
    if (!row || typeof row.slug !== 'string' || seen.has(row.slug)
      || !MINIMAL_RITUAL_HABITS.some(habit => habit.slug === row.slug)
      || typeof row.recorded_today !== 'boolean' || typeof row.ticked_today !== 'boolean'
      || (row.participation_mode !== null && !isMinimalRitualParticipationMode(row.participation_mode))
      || row.recorded_today !== (row.participation_mode !== null)
      || row.ticked_today !== (row.participation_mode !== null && row.participation_mode !== 'rest')
      || !['progress_days', 'practice_days', 'rest_days', 'streak_days'].every(key =>
        typeof row[key] === 'number' && Number.isSafeInteger(row[key]) && Number(row[key]) >= 0)
      || Number(row.progress_days) !== Number(row.practice_days) + Number(row.rest_days)) return null
    seen.add(row.slug)
  }
  return json as unknown as MinimalRitualToday
}

export default function MinimalHabitsList({
  initialStatus, initialDay, timeZone = DEFAULT_WELLBEING_TIME_ZONE, initialError = null,
}: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [day, setDay] = useState(initialDay)
  const [selections, setSelections] = useState<Partial<Record<MinimalRitualHabit, MinimalRitualParticipationMode>>>({})
  const [pendingSlug, setPendingSlug] = useState<MinimalRitualHabit | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [readError, setReadError] = useState<string | null>(initialError)
  const [notice, setNotice] = useState<string | null>(null)
  const requestActive = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controllerRef.current?.abort()
    }
  }, [])

  const refresh = useCallback(async () => {
    if (requestActive.current) return
    requestActive.current = true
    setRefreshing(true)
    const controller = new AbortController()
    controllerRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch('/api/minimal-ritual/today', { cache: 'no-store', signal: controller.signal })
      const json: unknown = await response.json().catch(() => null)
      const snapshot = snapshotValue(json, timeZone)
      if (!response.ok || !snapshot) {
        const error = objectValue(json)?.error
        throw new RitualRequestError(typeof error === 'string' ? error : 'Récapitulatif indisponible. Réessaie dans un instant.')
      }
      if (!mounted.current || controller.signal.aborted) return
      setStatus(snapshot.habits)
      setDay(snapshot.day)
      setReadError(null)
    } catch (error) {
      if (mounted.current) {
        setReadError(error instanceof RitualRequestError
          ? error.message : 'Connexion interrompue. Tes choix enregistrés sont conservés.')
      }
    } finally {
      clearTimeout(timeout)
      requestActive.current = false
      if (controllerRef.current === controller) controllerRef.current = null
      if (mounted.current) setRefreshing(false)
    }
  }, [timeZone])

  // A tab kept open overnight must not continue presenting yesterday as today.
  useEffect(() => {
    const checkDay = () => {
      if (localDay(new Date(), timeZone) !== day) void refresh()
    }
    window.addEventListener('focus', checkDay)
    const timer = setInterval(checkDay, 60_000)
    return () => {
      window.removeEventListener('focus', checkDay)
      clearInterval(timer)
    }
  }, [day, refresh, timeZone])

  async function record(slug: MinimalRitualHabit) {
    if (requestActive.current || status.find(row => row.slug === slug)?.recorded_today) return
    const mode = selections[slug] ?? 'standard'
    requestActive.current = true
    setPendingSlug(slug)
    setNotice(null)
    const controller = new AbortController()
    controllerRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch('/api/minimal-ritual/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit_slug: slug, participation_mode: mode }),
        signal: controller.signal,
      })
      const json = objectValue(await response.json().catch(() => null))
      if (!response.ok || json?.recorded !== true || typeof json.already !== 'boolean'
        || !isMinimalRitualParticipationMode(json.participation_mode)
        || json.ticked !== (json.participation_mode !== 'rest')
        || typeof json.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(json.day)
        || json.time_zone !== timeZone) {
        throw new RitualRequestError(typeof json?.error === 'string' ? json.error : 'Enregistrement non confirmé. Réessaie dans un instant.')
      }
      if (!mounted.current || controller.signal.aborted) return
      const snapshot = snapshotValue(json, timeZone)
      const savedStatus = snapshot?.habits.find(row => row.slug === slug)
      if (snapshot && savedStatus?.recorded_today && savedStatus.participation_mode === json.participation_mode) {
        setStatus(snapshot.habits)
        setDay(snapshot.day)
        setReadError(null)
      } else {
        // The event is confirmed, but there is no trustworthy new counter to display.
        setReadError(typeof json.status_warning === 'string'
          ? json.status_warning : 'Ton choix est enregistré. Actualise pour retrouver le récapitulatif.')
      }
      const message = json.already
        ? 'Ton choix était déjà enregistré pour cette journée.'
        : json.participation_mode === 'rest'
          ? 'Repos enregistré. Aucun exercice n’est déclaré réalisé.'
          : 'Ton geste est enregistré.'
      setNotice(message)
      toast.success(message)
    } catch (error) {
      if (mounted.current) {
        toast.error(error instanceof RitualRequestError
          ? error.message : 'Enregistrement non confirmé. Tu peux réessayer sans créer un doublon.')
      }
    } finally {
      clearTimeout(timeout)
      requestActive.current = false
      if (controllerRef.current === controller) controllerRef.current = null
      if (mounted.current) setPendingSlug(null)
    }
  }

  const practicedToday = status.filter(row => row.ticked_today).length
  const restToday = status.filter(row => row.participation_mode === 'rest').length
  const busy = pendingSlug !== null || refreshing

  return (
    <section aria-label="Tes gestes et tes choix de repos" data-testid="minimal-habits-list">
      <p className="text-xs text-white/60">Journée du {day} · {timeZone}</p>
      <p className="mt-2 text-xs leading-relaxed text-white/55">
        Les jours reconnus comptent tes gestes ou pauses déclarés, sans évaluer ta santé.
        Une interruption ne les efface pas.
      </p>
      {notice && <p role="status" className="mt-3 text-sm text-emerald-200">{notice}</p>}
      {readError ? (
        <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
          <p role="alert" className="text-sm text-amber-100">{readError}</p>
          <button type="button" onClick={() => void refresh()} disabled={busy}
            className="mt-3 rounded-lg border border-white/30 px-3 py-2 text-sm disabled:opacity-60">
            {refreshing ? 'Actualisation…' : 'Réessayer la lecture'}
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4 mt-3 text-sm text-white/70" aria-live="polite">
            Aujourd’hui : {practicedToday} geste{practicedToday > 1 ? 's' : ''} déclaré{practicedToday > 1 ? 's' : ''}
            {' · '}{restToday} choix de repos.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MINIMAL_RITUAL_HABITS.map(habit => {
              const row = status.find(item => item.slug === habit.slug)
              if (!row) return null
              const mode = row.participation_mode ?? selections[habit.slug] ?? 'standard'
              const rest = mode === 'rest'
              const loading = pendingSlug === habit.slug
              const prompt = rest ? MINIMAL_RITUAL_REST_PROMPT
                : mode === 'adapted' ? MINIMAL_RITUAL_ADAPTED_PROMPTS[habit.slug] : habit.tagline_fr
              return (
                <article key={habit.slug} data-testid={'minimal-card-' + habit.slug}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl" aria-hidden="true">{habit.emoji}</span>
                    <div>
                      <h3 className="text-sm font-medium text-white">{habit.name}</h3>
                      <p className="mt-1 text-xs text-white/50">
                        {rest ? 'Repos choisi' : 'Format indicatif : ' + habit.duration_sec + ' s'}
                      </p>
                    </div>
                  </div>
                  <fieldset disabled={busy || row.recorded_today} className="mt-4">
                    <legend className="sr-only">Ta manière de participer à {habit.name}</legend>
                    <div className="flex flex-wrap gap-2">
                      {MINIMAL_RITUAL_MODE_OPTIONS.map(option => (
                        <label key={option.value} className="inline-flex items-center gap-1.5 text-xs text-white/75">
                          <input type="radio" name={'minimal-mode-' + habit.slug} value={option.value}
                            aria-label={option.label + ' — ' + habit.name}
                            checked={mode === option.value}
                            onChange={() => setSelections(previous => ({ ...previous, [habit.slug]: option.value }))} />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <p className="mt-3 text-xs leading-relaxed text-white/65">{prompt}</p>
                  {row.recorded_today ? (
                    <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-200">
                      {rest ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                      {rest ? 'Repos enregistré' : mode === 'adapted' ? 'Geste adapté déclaré' : 'Geste déclaré'}
                    </p>
                  ) : (
                    <button type="button" onClick={() => void record(habit.slug)} disabled={busy}
                      data-testid={'minimal-habit-' + habit.slug}
                      className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 disabled:opacity-60">
                      {loading ? 'Enregistrement…' : rest ? 'Enregistrer ce choix de repos' : 'J’ai fait ce geste'}
                    </button>
                  )}
                  {row.progress_days > 0 && (
                    <p className="mt-3 text-xs text-white/60" data-testid={'minimal-progress-' + habit.slug}>
                      {row.progress_days} jour{row.progress_days > 1 ? 's' : ''} reconnu{row.progress_days > 1 ? 's' : ''} au total
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

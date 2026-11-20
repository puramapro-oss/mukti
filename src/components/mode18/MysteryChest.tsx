'use client'

// The route/component name is retained for existing links. No chest or draw remains.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Leaf, Loader2, RefreshCw } from 'lucide-react'
import {
  LEGACY_REWARD_LABELS,
  RECOGNITION_FORMAT,
  RECOGNITION_MESSAGE,
  RECOGNITION_TIME_ZONE,
  isDailyRecognition,
  isRecognitionOverview,
  mergeRecognitionHistory,
  utcRecognitionDate,
  type RecognitionOverview,
} from '@/lib/daily-recognition'

interface Props {
  initialOverview: RecognitionOverview | null
  initialError?: string | null
}

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})
const formatDay = (day: string) => dayFormatter.format(new Date(`${day}T12:00:00.000Z`))

export default function MysteryChest({ initialOverview, initialError = null }: Props) {
  const [overview, setOverview] = useState(initialOverview)
  const [historyLoaded, setHistoryLoaded] = useState(initialOverview !== null)
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState<'record' | 'refresh' | null>(null)
  const mounted = useRef(true)
  const active = useRef<{ controller: AbortController; timeout: ReturnType<typeof setTimeout> } | null>(null)

  const request = useCallback(async (action: 'record' | 'refresh') => {
    // This synchronous guard also covers double clicks before React re-renders.
    if (active.current) return
    const controller = new AbortController()
    const current = { controller, timeout: setTimeout(() => controller.abort(), 10_000) }
    active.current = current
    setBusy(action)
    try {
      const response = await fetch(action === 'record'
        ? '/api/mystery-rewards/claim-daily'
        : '/api/mystery-rewards/history', {
        method: action === 'record' ? 'POST' : 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })
      const body: unknown = await response.json()
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (!mounted.current) return
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('Réponse non confirmée. Actualise pour vérifier.')
      }
      const data = body as Record<string, unknown>
      if (!response.ok || data.ok !== true) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Enregistrement non confirmé. Réessaie.')
      }
      if (action === 'record') {
        if (data.format !== RECOGNITION_FORMAT || data.time_zone !== RECOGNITION_TIME_ZONE
          || data.financial_value !== false || typeof data.already_recorded !== 'boolean'
          || !isDailyRecognition(data.recognition)) {
          throw new Error('Réponse non confirmée. Actualise pour vérifier.')
        }
        const recognition = data.recognition
        setOverview(previous => ({
          format: RECOGNITION_FORMAT,
          time_zone: RECOGNITION_TIME_ZONE,
          today: recognition.recognition_date,
          recognition,
          recognitions: mergeRecognitionHistory(previous?.recognitions ?? [], recognition),
          legacy_rewards: previous?.legacy_rewards ?? [],
        }))
      } else {
        if (!isRecognitionOverview(data)) throw new Error('Historique non confirmé. Réessaie.')
        setOverview(data)
        setHistoryLoaded(true)
      }
      setError(null)
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error && cause.name !== 'AbortError'
          ? cause.message
          : 'Pas de confirmation reçue. Actualise avant de réessayer.')
      }
    } finally {
      clearTimeout(current.timeout)
      if (active.current === current) active.current = null
      if (mounted.current) setBusy(null)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (active.current) {
        clearTimeout(active.current.timeout)
        active.current.controller.abort()
        active.current = null
      }
    }
  }, [])

  useEffect(() => {
    // Refresh after a day boundary or return from another tab; never mutate in the background.
    const today = overview?.today ?? utcRecognitionDate()
    const tomorrow = new Date(`${today}T00:00:00.000Z`).getTime() + 86_400_000
    const timer = setTimeout(() => { void request('refresh') }, Math.max(1_000, tomorrow - Date.now() + 250))
    const visible = () => { if (document.visibilityState === 'visible') void request('refresh') }
    const focused = () => { void request('refresh') }
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', focused)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('focus', focused)
    }
  }, [overview?.today, request])

  const recorded = !!overview?.recognition

  return (
    <div className="space-y-6" data-testid="daily-recognition">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8" aria-labelledby="recognition-title">
        <Leaf className="h-9 w-9 text-emerald-300" aria-hidden="true" />
        <h2 id="recognition-title" className="mt-4 text-xl font-medium text-white">{RECOGNITION_MESSAGE}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Une pratique, du repos ou une journée sans activité : tu peux simplement reconnaître
          ce que tu as traversé. Aucun exercice ni résultat à prouver.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Cette reconnaissance est gratuite, sans valeur financière. Elle ne modifie pas tes
          points, ton argent ou tes quotas. Tu peux revenir quand tu le souhaites.
        </p>

        <div className="mt-6" role="status" aria-live="polite">
          {recorded && (
            <p className="mb-4 flex items-center gap-2 text-sm text-emerald-200">
              <Check className="h-4 w-4" aria-hidden="true" />
              Journée du {formatDay(overview!.recognition!.recognition_date)} enregistrée.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { void request('record') }}
          disabled={recorded || busy !== null}
          data-testid="daily-recognition-record"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-medium text-slate-950 disabled:cursor-default disabled:opacity-60"
        >
          {busy === 'record' && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {recorded ? 'Journée enregistrée' : busy === 'record' ? 'Enregistrement…' : 'Reconnaître ma journée'}
        </button>
        <p className="mt-3 text-xs leading-relaxed text-white/50">
          Une entrée par journée UTC, de 00 h à 24 h. Les journées absentes ne retirent aucun acquis.
        </p>
      </section>

      {error && <p role="alert" className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-100">{error}</p>}

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5" aria-labelledby="recognition-history-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recognition-history-title" className="text-sm font-medium text-white">Journées enregistrées</h2>
          <button type="button" onClick={() => { void request('refresh') }} disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs text-white/75 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Actualiser
          </button>
        </div>
        {!historyLoaded && <p className="mt-3 text-sm text-white/65">L’historique n’a pas encore pu être chargé.</p>}
        {historyLoaded && overview?.recognitions.length === 0 && (
          <p className="mt-3 text-sm text-white/65">Aucune journée enregistrée pour le moment.</p>
        )}
        {!!overview?.recognitions.length && (
          <>
            <p className="mt-2 text-xs text-white/50">Les 14 dernières entrées, même espacées.</p>
            <ul className="mt-4 space-y-2" data-testid="daily-recognition-history">
              {overview.recognitions.map(row => (
                <li key={row.id} className="flex items-center gap-2 text-sm text-white/75">
                  <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <time dateTime={row.recognition_date}>{formatDay(row.recognition_date)}</time>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {historyLoaded && !!overview?.legacy_rewards.length && (
        <details className="rounded-3xl border border-white/10 bg-white/[0.03] p-5" data-testid="legacy-reward-history">
          <summary className="cursor-pointer text-sm font-medium text-white/80">Historique des anciens reçus</summary>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Ces reçus restent conservés. Leur présence ne confirme pas la délivrance d’un avantage
            ou d’un crédit : ce statut n’est pas vérifié ici. Aucun ancien solde n’est modifié.
          </p>
          <ul className="mt-4 space-y-3">
            {overview.legacy_rewards.map(row => (
              <li key={row.id} className="text-sm text-white/70">
                <time dateTime={row.claim_date}>{formatDay(row.claim_date)}</time>
                {' · Type : '}{LEGACY_REWARD_LABELS[row.reward_type]}
                {row.reward_type !== 'nothing' && <span className="mt-1 block text-xs text-white/60">Valeur enregistrée : {row.reward_amount}</span>}
                <span className="mt-1 block text-xs text-white/45">Délivrance non vérifiée</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

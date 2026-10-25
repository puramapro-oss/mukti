'use client'

import { useEffect, useRef, useState } from 'react'
import { createLocalFrequencyMeter, INITIAL_FREQUENCY_STATE } from '../../lib/audio/local-frequency-meter'

export default function FrequencyMeter() {
  const [state, setState] = useState(INITIAL_FREQUENCY_STATE)
  const meter = useRef<ReturnType<typeof createLocalFrequencyMeter> | null>(null)
  const [sourceReady, setSourceReady] = useState(false)

  useEffect(() => {
    const current = createLocalFrequencyMeter(setState)
    meter.current = current
    return () => { current.dispose(); if (meter.current === current) meter.current = null }
  }, [])

  const active = state.status === 'requesting' || state.status === 'listening'
  const reading = state.reading
  const label = !reading ? state.message
    : reading.status === 'silence' ? 'Signal trop faible pour estimer une fréquence.'
    : reading.status === 'clipped' ? 'Crêtes trop élevées, saturation possible : éloigne la source ou baisse son volume.'
    : reading.status === 'uncertain' ? 'Signal incertain ou plusieurs composantes sonores.'
    : reading.status === 'off_target' ? 'Fréquence dominante différente de 432 Hz.'
    : state.stable ? 'Composante dominante stable, proche de 432 Hz.'
    : 'Composante proche de 432 Hz : vérification de sa stabilité…'
  const canShowFrequency = reading && (reading.status === 'near_target' || reading.status === 'off_target') && reading.dominantHz !== null

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6" aria-labelledby="frequency-meter-title" data-testid="frequency-meter">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Audio · mesure locale</p>
          <h2 id="frequency-meter-title" className="text-lg font-semibold text-[var(--text-primary)]">Mesurer un son à 432 Hz</h2>
        </div>
        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)]">Cible : 432 Hz</span>
      </div>

      <p className="mt-3 text-sm text-[var(--text-secondary)]">Le microphone estime la fréquence d’un son audible. Cette mesure reste sur cet appareil, sans enregistrement ni envoi du son.</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-[var(--text-secondary)]">
        <input type="checkbox" checked={sourceReady} disabled={active} onChange={(event) => setSourceReady(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
        <span>J’ai arrêté les sons de cet appareil et je mesure une source externe. Un son capté ne permet pas d’identifier l’appareil qui l’émet.</span>
      </label>

      <div className="my-5 rounded-xl border border-[var(--border)] p-4">
        <p className="text-xs text-[var(--text-muted)]">Fréquence estimée · microphone</p>
        <output className="mt-1 block text-3xl font-semibold tabular-nums text-[var(--text-primary)]" data-testid="measured-frequency">
          {canShowFrequency ? `${reading.dominantHz!.toFixed(1)} Hz` : '—'}
        </output>
        <p className="mt-2 text-sm text-[var(--text-secondary)]" role="status" aria-live="polite" data-testid="measurement-status">{label}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => { void meter.current?.start() }} disabled={!sourceReady || active}
          className="min-h-11 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-45">
          {state.status === 'requesting' ? 'Autorisation en cours…' : 'Démarrer la mesure'}
        </button>
        <button type="button" onClick={() => meter.current?.stop()} disabled={!active}
          className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-45">Arrêter le microphone</button>
      </div>

      <p className="mt-3 text-xs text-[var(--text-muted)]">Arrêt automatique après une minute, quand tu quittes cet écran ou si la capture est interrompue.</p>
      {state.status === 'listening' && (
        <p className="mt-2 text-xs text-[var(--text-muted)]" data-testid="input-processing">
          {state.processing === 'reported-off' ? 'Le navigateur déclare les corrections automatiques désactivées.'
            : state.processing === 'active' ? 'Des corrections automatiques restent actives : l’estimation peut être modifiée.'
            : 'Les corrections automatiques ne sont pas entièrement renseignées par le navigateur.'}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">Estimation indicative, non étalonnée. Elle ne mesure ni un champ électromagnétique, ni une « énergie positive », ni un effet de soin. La valeur cible n’est jamais utilisée comme résultat mesuré.</p>
    </section>
  )
}

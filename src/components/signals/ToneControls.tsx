'use client'

import { useEffect, useRef, useState } from 'react'
import { createPureTonePlayer, TONE_INITIAL_GAIN, TONE_MAX_GAIN, type ToneStatus } from '@/lib/pure-tone-player'
import type { ToneProgram } from '@/lib/tone-program'

/** Key this component by its program: changing instructions stops the old player. */
export default function ToneControls({ program }: { program: ToneProgram }) {
  const player = useRef<ReturnType<typeof createPureTonePlayer> | null>(null)
  const [status, setStatus] = useState<ToneStatus>('idle')
  const [error, setError] = useState<string | undefined>()
  const [volume, setVolume] = useState(TONE_INITIAL_GAIN)
  useEffect(() => {
    const current = createPureTonePlayer((next, message) => { setStatus(next); setError(message) })
    player.current = current
    const leave = () => current.stop()
    const visibility = () => { if (document.hidden) leave() }
    window.addEventListener('pagehide', leave)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('pagehide', leave)
      document.removeEventListener('visibilitychange', visibility)
      current.dispose()
      if (player.current === current) player.current = null
    }
  }, [])

  const active = status === 'starting' || status === 'playing'
  return (
    <section aria-label="Lecture de la tonalité" className="space-y-5 rounded-2xl border border-white/15 bg-white/5 p-6">
      <p className="text-3xl font-medium tabular-nums">{program.hz} Hz <span className="text-base text-white/60">· {program.seconds / 60} min</span></p>
      <p className="text-sm text-white/70">Sinusoïde audible générée sur cet appareil. Aucun microphone ni conversation.</p>
      <label className="block text-sm">Volume local — gain numérique, pas une mesure en décibels
        <input aria-label="Volume local" type="range" min="0" max={TONE_MAX_GAIN} step="0.005" value={volume}
          onChange={event => { const value = Number(event.target.value); setVolume(value); player.current?.setVolume(value) }}
          className="mt-3 block w-full" />
      </label>
      <button type="button" data-testid="tone-toggle" aria-pressed={active}
        onClick={() => { if (active) player.current?.stop(); else void player.current?.start(program) }}
        className="rounded-xl bg-white px-6 py-3 font-medium text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        {status === 'starting' ? 'Annuler le démarrage' : status === 'playing' ? 'Arrêter la tonalité' : 'Écouter la tonalité'}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-white/70">
        {status === 'playing' ? 'Lecture locale en cours. Arrêt automatique à la durée indiquée.' : status === 'starting' ? 'Autorisation audio en cours…' : 'Lecture arrêtée. Aucun redémarrage automatique.'}
      </p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <p className="text-xs text-white/60">Commence avec un faible volume sur ton téléphone ou ton casque. Arrête en cas d’inconfort. La restitution dépend de ta sortie audio. La mise en arrière-plan arrête cette version du lecteur.</p>
    </section>
  )
}

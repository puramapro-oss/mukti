'use client'

import { useEffect, useRef, useState } from 'react'
import { createCircleListener, type CircleListenerHandle, type CircleListenerState } from '@/lib/circle-listener'

/** Explicit, local playback consent. Membership is still enforced by the existing route. */
export default function CircleListeningPanel({ circleId }: { circleId: string }) {
  const [status, setStatus] = useState<CircleListenerState>('stopped')
  const [volume, setVolume] = useState(0.25)
  const [error, setError] = useState<string | null>(null)
  const handleRef = useRef<CircleListenerHandle | null>(null)
  const generation = useRef(0)

  useEffect(() => () => {
    generation.current += 1
    handleRef.current?.stop()
    handleRef.current = null
  }, [circleId])

  function start() {
    if (handleRef.current) return
    const attempt = ++generation.current
    setError(null)
    const handle = createCircleListener({
      circleId,
      volume,
      onState: (next) => { if (attempt === generation.current) setStatus(next) },
      onError: (message) => {
        if (attempt !== generation.current) return
        handleRef.current = null
        setError(message)
      },
    })
    handleRef.current = handle
    void handle.start()
  }

  function stop() {
    generation.current += 1
    handleRef.current?.stop()
    handleRef.current = null
    setStatus('stopped')
  }

  const active = status !== 'stopped' && status !== 'error'
  return (
    <section aria-label="Écoute seule du cercle" className="w-full max-w-lg rounded-xl border border-white/15 bg-black/30 p-3 text-sm">
      <p className="font-medium">Écoute sur ce téléphone ou ordinateur</p>
      <p className="mt-1 text-xs text-white/60">Sans microphone ni achat d’appareil. Les conditions d’accès et la capacité du cercle restent applicables.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={active ? stop : start} className="rounded-lg border border-white/20 px-3 py-2">
          {active ? 'Arrêter l’écoute' : 'Écouter sans microphone'}
        </button>
        {status === 'playback-blocked' && (
          <button type="button" onClick={() => { void handleRef.current?.resumeAudio() }} className="rounded-lg border border-white/20 px-3 py-2">
            Autoriser le son sur cet appareil
          </button>
        )}
        <label className="flex items-center gap-2">
          Volume local
          <input type="range" aria-label="Volume local de l’écoute" min="0" max="100" step="1" value={Math.round(volume * 100)} onChange={(event) => {
            const next = Number(event.target.value) / 100
            setVolume(next)
            handleRef.current?.setVolume(next)
          }} />
        </label>
      </div>
      <p aria-live="polite" className="mt-2 text-xs text-white/60">
        {status === 'connecting' && 'Connexion au relais audio…'}
        {status === 'connected' && 'Réception connectée. Le son dépend du contenu partagé par les participants.'}
        {status === 'reconnecting' && 'Liaison interrompue : reconnexion du relais…'}
        {status === 'playback-blocked' && 'Le navigateur demande une autorisation pour lire le son.'}
        {status === 'stopped' && 'Aucune écoute en cours.'}
      </p>
      {error && <p role="alert" className="mt-2 text-xs text-red-200">{error}</p>}
    </section>
  )
}

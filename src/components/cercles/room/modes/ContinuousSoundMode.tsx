'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

interface ContinuousSoundModeProps {
  category: string
  accentColor?: string
}

// Fréquences Solfeggio par catégorie (Hz)
const FREQS: Record<string, { hz: number; label: string }> = {
  amour_soi: { hz: 528, label: '528 Hz — amour' },
  liberation: { hz: 396, label: '396 Hz — libération' },
  apaisement: { hz: 432, label: '432 Hz — calme' },
  paix: { hz: 432, label: '432 Hz — paix' },
  clarte: { hz: 741, label: '741 Hz — éveil' },
  alignement: { hz: 639, label: '639 Hz — relation' },
  abondance: { hz: 528, label: '528 Hz — abondance' },
  motivation: { hz: 741, label: '741 Hz — activation' },
  renouveau: { hz: 417, label: '417 Hz — renouveau' },
  confiance: { hz: 528, label: '528 Hz — confiance' },
  protection: { hz: 396, label: '396 Hz — ancrage' },
  ancrage: { hz: 396, label: '396 Hz — terre' },
  gratitude: { hz: 639, label: '639 Hz — gratitude' },
  manifestation: { hz: 852, label: '852 Hz — intuition' },
}

export default function ContinuousSoundMode({ category, accentColor = '#7C3AED' }: ContinuousSoundModeProps) {
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  const freq = FREQS[category] ?? FREQS.paix

  useEffect(() => {
    return () => {
      stopTone()
    }
  }, [])

  function startTone() {
    try {
      const Ctx: typeof AudioContext =
        (window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq.hz
      gain.gain.value = 0
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      // fade in doux
      const now = ctx.currentTime
      gain.gain.linearRampToValueAtTime(0.08, now + 1.5)
      ctxRef.current = ctx
      oscRef.current = osc
      gainRef.current = gain
      setPlaying(true)
      setError(null)
    } catch {
      setError('Audio non disponible sur ce navigateur.')
    }
  }

  function stopTone() {
    const ctx = ctxRef.current
    const gain = gainRef.current
    const osc = oscRef.current
    if (ctx && gain && osc) {
      const now = ctx.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.linearRampToValueAtTime(0, now + 0.8)
      setTimeout(() => {
        try { osc.stop() } catch {}
        try { ctx.close() } catch {}
      }, 900)
    }
    ctxRef.current = null
    oscRef.current = null
    gainRef.current = null
    setPlaying(false)
  }

  function toggle() {
    if (playing) stopTone()
    else startTone()
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-4">
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span
          className={`absolute inset-0 rounded-full ${playing ? 'animate-ping' : ''}`}
          style={{ background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)` }}
          aria-hidden
        />
        <button
          type="button"
          onClick={toggle}
          className="relative flex h-24 w-24 items-center justify-center rounded-full border text-white/85 transition-all hover:scale-105"
          style={{ borderColor: accentColor, backgroundColor: `${accentColor}15` }}
          data-testid="sound-toggle"
          aria-label={playing ? 'Arrêter la fréquence' : 'Lancer la fréquence'}
        >
          {playing ? <Volume2 className="h-8 w-8" /> : <VolumeX className="h-8 w-8" />}
        </button>
      </div>
      <p className="text-sm text-white/70">{freq.label}</p>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <p className="text-xs text-white/40">
        {playing ? 'Fréquence diffusée — baisse le volume à ton aise' : 'Appuie pour lancer — volume faible conseillé'}
      </p>
    </div>
  )
}

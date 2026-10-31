'use client'

import ToneControls from '@/components/signals/ToneControls'
import type { ToneProgram } from '@/lib/tone-program'

interface ContinuousSoundModeProps { category: string; accentColor?: string }

// Preserve the existing category choices. Names describe themes, not measured biological effects.
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
  const freq = FREQS[category] ?? FREQS.paix
  const program: ToneProgram = { version: 1, hz: freq.hz, seconds: 600 }
  return (
    <div className="space-y-4 py-4">
      <p className="text-center text-sm" style={{ color: accentColor }}>{freq.label}</p>
      <ToneControls key={`${category}:${freq.hz}`} program={program} />
      <p className="text-xs text-white/50">Thème spirituel au choix, sans effet médical garanti. Une nouvelle écoute de dix minutes demande un nouveau démarrage.</p>
    </div>
  )
}

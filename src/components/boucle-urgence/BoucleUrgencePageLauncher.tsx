'use client'

// MUKTI — G5.7 BoucleUrgencePageLauncher
// CTA client sur la page /dashboard/boucle-urgence : sélecteur durée + bouton.

import { useState } from 'react'
import { EyeOff } from 'lucide-react'
import {
  BOUCLE_URGENCE_DEFAULT_DURATION_SEC,
  BOUCLE_URGENCE_DURATION_CHOICES_SEC,
} from '@/lib/boucle-urgence-utils'
import { useBoucleUrgence } from './BoucleUrgenceProvider'

function formatMin(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.round(sec / 60)
  return `${m} min`
}

export default function BoucleUrgencePageLauncher() {
  const { openBoucle } = useBoucleUrgence()
  const [duration, setDuration] = useState<number>(BOUCLE_URGENCE_DEFAULT_DURATION_SEC)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.22em] text-white/40">Durée</span>
        <div className="flex flex-wrap gap-2">
          {BOUCLE_URGENCE_DURATION_CHOICES_SEC.map(sec => {
            const active = duration === sec
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setDuration(sec)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-[#06B6D4]/60 bg-[#06B6D4]/20 text-[#7DD3FC]'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
                }`}
              >
                {formatMin(sec)}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => openBoucle('page', duration)}
        data-testid="boucle-urgence-page-launch"
        className="group inline-flex items-center gap-3 self-start rounded-full border border-[#06B6D4]/40 bg-gradient-to-r from-[#06B6D4]/20 to-[#0891B2]/20 px-6 py-3 text-sm font-medium text-white shadow-[0_0_30px_rgba(6,182,212,0.18)] transition-all hover:from-[#06B6D4]/30 hover:to-[#0891B2]/30 hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]"
      >
        <EyeOff className="h-4 w-4 text-[#7DD3FC]" />
        Activer le camouflage
      </button>

      <p className="text-xs text-white/40">
        Astuce : raccourci clavier{' '}
        <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/70">
          B
        </kbd>{' '}
        ×{' '}
        <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/70">
          B
        </kbd>{' '}
        (double-tap, &lt; 500 ms).
      </p>
    </div>
  )
}

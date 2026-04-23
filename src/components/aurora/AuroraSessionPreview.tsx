'use client'

// MUKTI — G5.2 AURORA Session Preview
// Page session minimale : Canvas fractal + breath indicator + STOP + toggle particles.
// Driver = useDemoBreath (G5.2). Sera remplacé par useAuroraPhase + full state machine en G5.3.

import { useState } from 'react'
import { Play, Pause, Sparkles, EyeOff, Eye } from 'lucide-react'
import AuroraCanvas from './AuroraCanvas'
import PulseOfSafety from './PulseOfSafety'
import { useDemoBreath } from './useDemoBreath'
import { AURORA_VARIANTS, type AuroraVariant } from '@/lib/constants'

export interface AuroraSessionPreviewProps {
  variant: AuroraVariant
}

export default function AuroraSessionPreview({ variant }: AuroraSessionPreviewProps) {
  const meta = AURORA_VARIANTS.find((v) => v.id === variant)!
  const [active, setActive] = useState(false)
  const [particlesOn, setParticlesOn] = useState(true)
  const breath = useDemoBreath({
    inhaleSec: variant === 'ignite' ? 3 : 4,
    holdSec: variant === 'sleep' ? 1 : 2,
    exhaleSec: variant === 'sleep' ? 8 : variant === 'calm' ? 7 : 6,
    active,
  })

  const phaseLabel =
    breath.phase === 'inspire' ? 'Inspire'
    : breath.phase === 'expire' ? 'Expire'
    : breath.phase === 'hold' ? 'Pause'
    : 'Prêt·e ?'

  return (
    <div className="relative h-screen w-full">
      {/* Canvas 3D */}
      <AuroraCanvas
        breathState={breath}
        color={meta.color}
        particlesEnabled={particlesOn}
      />

      {/* Pulse of safety (sur expire) */}
      {active && <PulseOfSafety breathPhase={breath.phase} color={meta.color} />}

      {/* Phase indicator au centre bas */}
      {active && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2">
          <div
            className="rounded-full border border-white/15 bg-black/30 px-6 py-3 backdrop-blur-xl"
            style={{ boxShadow: `0 0 40px ${meta.color}40` }}
          >
            <div className="text-xs uppercase tracking-[0.3em] text-white/50">Phase</div>
            <div
              className="mt-0.5 text-lg font-light tracking-wide transition-colors duration-300"
              style={{ color: meta.color }}
            >
              {phaseLabel}
            </div>
          </div>
        </div>
      )}

      {/* Controls flottants bas */}
      <div className="absolute bottom-16 left-0 right-0 z-20 flex items-center justify-center gap-3 px-6">
        <button
          type="button"
          onClick={() => setActive((a) => !a)}
          className="group flex items-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
            boxShadow: `0 0 30px ${meta.color}60`,
          }}
          aria-label={active ? 'Mettre en pause' : 'Démarrer la session'}
        >
          {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span>{active ? 'Pause' : 'Démarrer'}</span>
        </button>

        <button
          type="button"
          onClick={() => setParticlesOn((p) => !p)}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-3 text-xs uppercase tracking-widest text-white/80 backdrop-blur-xl transition-colors hover:bg-white/[0.12]"
          aria-label={particlesOn ? 'Masquer les particules' : 'Afficher les particules'}
        >
          {particlesOn ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          <span>Particules</span>
        </button>
      </div>

      {/* Badge "Preview G5.2 — full flow G5.3" */}
      <div className="pointer-events-none absolute left-1/2 top-28 z-20 -translate-x-1/2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60 backdrop-blur">
          <Sparkles className="h-3 w-3" />
          Preview — 5 phases + audio + cohérence arrivent
        </span>
      </div>
    </div>
  )
}

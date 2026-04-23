'use client'

// MUKTI — G4.4 SpeciesPicker
// Carousel horizontal scrollable 7 tuiles glass + tuile sélectionnée mise en avant.
// Accessible : role=radiogroup, flèches clavier, aria-checked.

import { useEffect, useRef } from 'react'
import { SPECIES_ORDER, SPECIES_RIGS, type SpeciesRigConfig } from '@/lib/ar/species-rigs'
import type { ArSpeciesSlug } from '@/lib/constants'

export interface SpeciesPickerSpecies {
  slug: ArSpeciesSlug
  name_fr: string
  description_fr: string
  icon_glyph: string
  energy_color: string
}

interface Props {
  species: SpeciesPickerSpecies[]
  value: ArSpeciesSlug
  onChange: (slug: ArSpeciesSlug) => void
}

export default function SpeciesPicker({ species, value, onChange }: Props) {
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  // Scrolle la tuile sélectionnée en vue au changement
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [value])

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const currentIdx = SPECIES_ORDER.indexOf(value)
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const nextIdx = (currentIdx + delta + SPECIES_ORDER.length) % SPECIES_ORDER.length
    const next = SPECIES_ORDER[nextIdx]
    if (next) onChange(next)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Choisir une espèce"
      onKeyDown={handleKey}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pl-1 pr-1"
      data-testid="species-picker"
    >
      {species.map((s) => {
        const rig: SpeciesRigConfig = SPECIES_RIGS[s.slug]
        const isActive = value === s.slug
        return (
          <button
            key={s.slug}
            ref={isActive ? selectedRef : null}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-testid={`species-tile-${s.slug}`}
            onClick={() => onChange(s.slug)}
            className={`relative flex min-w-[160px] shrink-0 snap-center flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all sm:min-w-[180px] ${
              isActive
                ? 'scale-[1.02] border-white/30 bg-white/[0.06] shadow-lg'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <div
              className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
              style={{ background: rig.color, opacity: isActive ? 1 : 0.4 }}
              aria-hidden="true"
            />
            <span
              className="mt-2 text-3xl"
              style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(255,255,255,0.35))' : 'none' }}
              aria-hidden="true"
            >
              {s.icon_glyph || rig.glyph}
            </span>
            <span className="text-sm font-semibold text-white">{s.name_fr}</span>
            <span className="min-h-[2.5rem] text-[11px] leading-snug text-white/55">
              {s.description_fr}
            </span>
            {isActive && (
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: rig.color }}
              >
                ● Choisi
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

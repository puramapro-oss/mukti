'use client'

// MUKTI — G4.5 BeaconPicker
// 20 cibles curées — tabs par type + grid 2-col glass cards.

import { useMemo, useState } from 'react'
import { Globe, Heart, Leaf, Sparkles, Users } from 'lucide-react'
import type { ArBeacon } from '@/lib/ar'
import type { ArBeaconType } from '@/lib/constants'

interface Props {
  beacons: ArBeacon[]
  value: string | null
  onChange: (slug: string) => void
}

const TYPE_LABELS: Record<ArBeaconType, { label_fr: string; glyph: React.ComponentType<{ className?: string }>; emoji: string }> = {
  refuge_animalier: { label_fr: 'Refuges animaliers', glyph: Heart, emoji: '🐾' },
  ong_nature: { label_fr: 'ONG Nature', glyph: Leaf, emoji: '🌍' },
  element: { label_fr: 'Éléments', glyph: Sparkles, emoji: '🌊' },
  personne: { label_fr: 'Personnes', glyph: Users, emoji: '💫' },
  planete: { label_fr: 'Planète', glyph: Globe, emoji: '🌏' },
}

const TYPE_ORDER: ArBeaconType[] = ['refuge_animalier', 'ong_nature', 'element', 'personne', 'planete']

export default function BeaconPicker({ beacons, value, onChange }: Props) {
  const [activeType, setActiveType] = useState<ArBeaconType | 'all'>('all')

  const visibleBeacons = useMemo(() => {
    if (activeType === 'all') return beacons
    return beacons.filter((b) => b.type === activeType)
  }, [beacons, activeType])

  const countByType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const b of beacons) counts[b.type] = (counts[b.type] ?? 0) + 1
    return counts
  }, [beacons])

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs filter */}
      <div role="tablist" aria-label="Filtrer les cibles" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeType === 'all'}
          onClick={() => setActiveType('all')}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            activeType === 'all'
              ? 'border-white/30 bg-white/[0.06] text-white'
              : 'border-white/10 bg-white/[0.02] text-white/55 hover:bg-white/[0.04]'
          }`}
        >
          Tout ({beacons.length})
        </button>
        {TYPE_ORDER.map((t) => {
          const cfg = TYPE_LABELS[t]
          const count = countByType[t] ?? 0
          if (count === 0) return null
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={activeType === t}
              onClick={() => setActiveType(t)}
              data-testid={`beacon-tab-${t}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                activeType === t
                  ? 'border-white/30 bg-white/[0.06] text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/55 hover:bg-white/[0.04]'
              }`}
            >
              <span aria-hidden="true">{cfg.emoji}</span>
              {cfg.label_fr} ({count})
            </button>
          )
        })}
      </div>

      {/* Grid tuiles */}
      <div
        role="radiogroup"
        aria-label="Choisir une cible"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        data-testid="beacon-grid"
      >
        {visibleBeacons.map((b) => {
          const isActive = value === b.slug
          const cfg = TYPE_LABELS[b.type]
          return (
            <button
              key={b.slug}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(b.slug)}
              data-testid={`beacon-${b.slug}`}
              className={`relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-white/30 bg-white/[0.06] shadow-lg'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{
                  background: `linear-gradient(135deg, ${intentionToColor(b.intention_hint)}22, ${intentionToColor(b.intention_hint)}08)`,
                }}
                aria-hidden="true"
              >
                {cfg.emoji}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">{b.name_fr}</p>
                  {isActive && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--cyan)]">
                      ● Choisi
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  {cfg.label_fr}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-white/55">{b.description_fr}</p>
              </div>
            </button>
          )
        })}
      </div>

      {visibleBeacons.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center text-xs text-white/55">
          Aucune cible dans cette catégorie pour l&apos;instant.
        </p>
      )}
    </div>
  )
}

function intentionToColor(intention: string | null): string {
  const map: Record<string, string> = {
    paix: '#06B6D4',
    gratitude: '#F97316',
    amour_soi: '#EC4899',
    liberation: '#22C55E',
    protection: '#14B8A6',
    ancrage: '#A16207',
    clarte: '#8B5CF6',
    manifestation: '#D946EF',
    abondance: '#F59E0B',
    apaisement: '#06B6D4',
    motivation: '#EF4444',
    renouveau: '#10B981',
    confiance: '#7C3AED',
    alignement: '#3B82F6',
  }
  return (intention && map[intention]) || '#7C3AED'
}

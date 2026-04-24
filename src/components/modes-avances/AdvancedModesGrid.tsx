'use client'

// MUKTI — G5.8 AdvancedModesGrid
// Grid 9 cards : 4 actifs (Rituel 7s, Boucle Urgence, Exorcisme, Boîte Noire)
// + 5 teasers (Parfum Virtuel, Prédicteur, Hypnose Mouvement, Hologramme, Armure).
// Teaser → NotifyMeModal. Active → Link dashboard.

import { useState } from 'react'
import Link from 'next/link'
import { BellRing, ArrowRight } from 'lucide-react'
import { ADVANCED_MODES } from '@/lib/constants'
import NotifyMeModal from './NotifyMeModal'

interface Props {
  initialNotifiedModes: string[]
}

const ACTIVE_SLUG_ROUTES: Record<string, string> = {
  rituel_7s: '/dashboard/rituel-7s',
  boucle_urgence: '/dashboard/boucle-urgence',
  exorcisme: '/dashboard/exorcisme',
  boite_noire: '/dashboard/boite-noire',
}

export default function AdvancedModesGrid({ initialNotifiedModes }: Props) {
  const [notifiedModes, setNotifiedModes] = useState<string[]>(initialNotifiedModes)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMode, setSelectedMode] = useState<(typeof ADVANCED_MODES)[number] | null>(null)

  function openModal(mode: (typeof ADVANCED_MODES)[number]) {
    setSelectedMode(mode)
    setModalOpen(true)
  }

  function handleNotified(modeId: string) {
    setNotifiedModes(prev => (prev.includes(modeId) ? prev : [...prev, modeId]))
  }

  return (
    <>
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="advanced-modes-grid"
      >
        {ADVANCED_MODES.map(mode => {
          const isActive = mode.status === 'active'
          const route = ACTIVE_SLUG_ROUTES[mode.id]
          const notified = notifiedModes.includes(mode.id)

          if (isActive && route) {
            return (
              <Link
                key={mode.id}
                href={route}
                data-testid={`advanced-mode-active-${mode.id}`}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.06]"
                style={{
                  background: `linear-gradient(135deg, ${mode.color}18 0%, transparent 50%)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{mode.emoji}</span>
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-200">
                    Actif
                  </span>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/40">
                    Mode {mode.brief_num} · {mode.gate}
                  </div>
                  <h3 className="mt-1 text-lg font-medium text-white">{mode.name}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/60">
                    {mode.tagline_fr}
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-white/80 transition-colors group-hover:text-white">
                  Ouvrir
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            )
          }

          // Teaser
          return (
            <div
              key={mode.id}
              data-testid={`advanced-mode-teaser-${mode.id}`}
              className="relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5 opacity-80 backdrop-blur-xl"
            >
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40"
              />
              <div className="relative flex items-center justify-between">
                <span className="text-3xl opacity-90">{mode.emoji}</span>
                <span className="rounded-full border border-[#A855F7]/40 bg-[#A855F7]/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#C4B5FD]">
                  Phase Avancée
                </span>
              </div>
              <div className="relative">
                <div className="text-xs uppercase tracking-widest text-white/35">
                  Mode {mode.brief_num} · {mode.gate}
                </div>
                <h3 className="mt-1 text-lg font-medium text-white/85">{mode.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/50">
                  {mode.tagline_fr}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openModal(mode)}
                disabled={notified}
                data-testid={`advanced-mode-notify-btn-${mode.id}`}
                className="relative mt-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:border-[#A855F7]/30 disabled:bg-[#A855F7]/10 disabled:text-[#DDD6FE] disabled:opacity-100"
              >
                {notified ? (
                  <>
                    <BellRing className="h-3.5 w-3.5 text-[#DDD6FE]" />
                    Tu seras notifié·e
                  </>
                ) : (
                  <>
                    <BellRing className="h-3.5 w-3.5" />
                    Notifie-moi
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {selectedMode && (
        <NotifyMeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          modeId={selectedMode.id}
          modeName={selectedMode.name}
          modeEmoji={selectedMode.emoji}
          alreadyNotified={notifiedModes.includes(selectedMode.id)}
          onNotified={handleNotified}
        />
      )}
    </>
  )
}

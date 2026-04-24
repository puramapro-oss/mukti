'use client'

// MUKTI — G5.8 BoiteNoireEntriesList — affichage entries récentes d'une addiction.
// Client (refresh manuel possible via prop key changement).

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { BOITE_NOIRE_LOCATIONS, BOITE_NOIRE_WHO } from '@/lib/constants'
import type { BoiteNoireEntry } from '@/lib/boite-noire'

interface Props {
  addictionId: string
  refreshKey?: number
  initialEntries?: BoiteNoireEntry[]
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function locationName(id: string | null): { emoji: string; name: string } | null {
  if (!id) return null
  const found = BOITE_NOIRE_LOCATIONS.find(l => l.id === id)
  return found ? { emoji: found.emoji, name: found.name } : null
}

function whoName(id: string | null): { emoji: string; name: string } | null {
  if (!id) return null
  const found = BOITE_NOIRE_WHO.find(w => w.id === id)
  return found ? { emoji: found.emoji, name: found.name } : null
}

export default function BoiteNoireEntriesList({
  addictionId,
  refreshKey = 0,
  initialEntries,
}: Props) {
  const [entries, setEntries] = useState<BoiteNoireEntry[]>(initialEntries ?? [])
  const [loading, setLoading] = useState(!initialEntries)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let aborted = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const resp = await fetch(
          `/api/boite-noire/entries?addiction_id=${encodeURIComponent(addictionId)}&limit=20`,
          { cache: 'no-store' }
        )
        if (aborted) return
        if (!resp.ok) {
          const { error: errMsg } = await resp.json().catch(() => ({ error: null }))
          setError(errMsg ?? 'Impossible de charger — réessaie.')
          return
        }
        const data = (await resp.json()) as { entries: BoiteNoireEntry[] }
        setEntries(data.entries ?? [])
      } catch {
        if (!aborted) setError('Connexion perdue — réessaie.')
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [addictionId, refreshKey])

  if (loading && entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/50 backdrop-blur-xl">
        Chargement des déclencheurs…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-sm text-rose-200/80 backdrop-blur-xl">
        {error}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#7C3AED]/10 to-transparent p-6 text-center text-sm text-white/60 backdrop-blur-xl">
        Aucun déclencheur capturé pour l&apos;instant. Chaque entrée t&apos;aide à voir ton schéma.
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
      data-testid="boite-noire-entries-list"
    >
      {entries.map((e, idx) => {
        const loc = locationName(e.location_hint)
        const who = whoName(e.who_context)
        return (
          <article
            key={e.id}
            className={`flex flex-col gap-2 px-4 py-3 sm:px-5 ${
              idx > 0 ? 'border-t border-white/[0.04]' : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-white/55">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatDate(e.occurred_at)}</span>
                {loc && (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 uppercase tracking-widest">
                    {loc.emoji} {loc.name}
                  </span>
                )}
                {who && (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 uppercase tracking-widest">
                    {who.emoji} {who.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/70">
                  {e.intensity}/10
                </span>
                {e.resisted ? (
                  <span
                    className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-200"
                    data-testid="boite-noire-badge-resisted"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Résisté
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
                    <XCircle className="h-3 w-3" />
                    Cédé
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-white/80">{e.what_trigger}</p>
            {e.emotion && (
              <p className="text-xs italic text-white/50">« {e.emotion} »</p>
            )}
          </article>
        )
      })}
    </div>
  )
}

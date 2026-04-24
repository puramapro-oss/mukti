'use client'

// MUKTI — Mode 19 Rituel Minimaliste : 8 micro-habitudes + streak.

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Flame } from 'lucide-react'
import { MINIMAL_RITUAL_HABITS, type MinimalRitualHabit } from '@/lib/constants'

interface HabitStatus {
  slug: MinimalRitualHabit
  ticked_today: boolean
  streak_days: number
}

interface Props {
  initialStatus: HabitStatus[]
}

export default function MinimalHabitsList({ initialStatus }: Props) {
  const [status, setStatus] = useState<HabitStatus[]>(initialStatus)
  const [pending, startTransition] = useTransition()
  const [pendingSlug, setPendingSlug] = useState<MinimalRitualHabit | null>(null)

  function tick(slug: MinimalRitualHabit) {
    const row = status.find(s => s.slug === slug)
    if (row?.ticked_today) return
    setPendingSlug(slug)
    startTransition(async () => {
      try {
        const res = await fetch('/api/minimal-ritual/tick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ habit_slug: slug }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Impossible de valider.')
          return
        }
        setStatus(prev =>
          prev.map(s =>
            s.slug === slug
              ? {
                  ...s,
                  ticked_today: true,
                  streak_days: (s.streak_days || 0) + 1,
                }
              : s
          )
        )
        toast.success('Validé. Un souffle, un pas.')
      } catch {
        toast.error('Connexion interrompue.')
      } finally {
        setPendingSlug(null)
      }
    })
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      data-testid="minimal-habits-list"
    >
      {MINIMAL_RITUAL_HABITS.map(h => {
        const row = status.find(s => s.slug === h.slug) ?? {
          slug: h.slug,
          ticked_today: false,
          streak_days: 0,
        }
        const ticked = row.ticked_today
        const loading = pending && pendingSlug === h.slug
        return (
          <button
            type="button"
            key={h.slug}
            onClick={() => tick(h.slug)}
            disabled={ticked || loading}
            data-testid={`minimal-habit-${h.slug}`}
            className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
              ticked
                ? 'border-emerald-400/30 bg-emerald-500/10'
                : 'border-white/10 bg-white/[0.03] hover:border-white/25'
            } ${loading ? 'animate-pulse' : ''} disabled:cursor-default`}
          >
            <span className="text-2xl">{h.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">{h.name}</h3>
                <span className="text-[10px] uppercase tracking-widest text-white/40">
                  {h.duration_sec}s
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/60">{h.tagline_fr}</p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                {ticked && (
                  <span className="inline-flex items-center gap-1 text-emerald-200">
                    <Check className="h-3.5 w-3.5" />
                    Fait
                  </span>
                )}
                {row.streak_days > 0 && (
                  <span className="inline-flex items-center gap-1 text-[#F59E0B]">
                    <Flame className="h-3.5 w-3.5" />
                    {row.streak_days}j
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

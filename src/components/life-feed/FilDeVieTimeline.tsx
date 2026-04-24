'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

interface Entry {
  id: string
  kind: string
  label_fr: string
  value_cents: number | null
  country_code: string | null
  created_at: string
}

interface Props {
  initialEntries: Entry[]
  initialCursor: string | null
}

const KIND_ICONS: Record<string, string> = {
  mission_completed: '🌱',
  donation_made: '🎁',
  cercle_joined: '⭕',
  cercle_completed: '✨',
  core_event_joined: '🌀',
  ritual_7s: '🕯️',
  aurora_session: '🌈',
  addiction_freed: '🕊️',
  referral_success: '🤝',
  ambassador_tier_upgrade: '👑',
  contest_win: '🏆',
  rituel_hebdo_participated: '🌍',
  affirmation_seen: '🔆',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FilDeVieTimeline({ initialEntries, initialCursor }: Props) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(initialCursor === null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadMore = useCallback(async () => {
    if (loading || done || !cursor) return
    setLoading(true)
    try {
      const res = await fetch(`/api/life-feed/timeline?cursor=${encodeURIComponent(cursor)}`)
      if (!res.ok) return
      const data = (await res.json()) as { entries: Entry[]; nextCursor: string | null }
      setEntries(prev => [...prev, ...data.entries])
      setCursor(data.nextCursor)
      if (!data.nextCursor) setDone(true)
    } finally {
      setLoading(false)
    }
  }, [cursor, loading, done])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ents => {
        if (ents[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '120px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  if (entries.length === 0) {
    return (
      <div
        data-testid="life-feed-empty"
        className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur-xl"
      >
        <Sparkles className="mx-auto h-8 w-8 text-pink-300" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-semibold text-white">Ton fil commence ici</h3>
        <p className="mt-2 text-sm text-white/60">
          Chaque mission, chaque rituel, chaque parrainage deviendra une pierre dans ton chemin.
        </p>
      </div>
    )
  }

  return (
    <div>
      <ol className="relative space-y-4 border-l border-white/10 pl-6" data-testid="life-feed-timeline">
        {entries.map(e => (
          <li key={e.id} className="relative">
            <span
              className="absolute -left-[30px] top-1.5 text-xl"
              aria-hidden="true"
            >
              {KIND_ICONS[e.kind] ?? '✨'}
            </span>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl">
              <p className="text-sm font-medium text-white">{e.label_fr}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/50">
                <time dateTime={e.created_at}>{formatDate(e.created_at)}</time>
                {e.country_code && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                    {e.country_code}
                  </span>
                )}
                {e.value_cents !== null && e.value_cents > 0 && (
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
                    +{(e.value_cents / 100).toFixed(2)}€
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {!done && (
        <div ref={sentinelRef} className="mt-6 flex justify-center">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Chargement…
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void loadMore()}
              data-testid="life-feed-load-more"
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/70 hover:border-white/50 hover:text-white"
            >
              Charger plus
            </button>
          )}
        </div>
      )}
      {done && entries.length > 0 && (
        <p className="mt-6 text-center text-xs text-white/40">Tu as tout lu. ✨</p>
      )}
    </div>
  )
}

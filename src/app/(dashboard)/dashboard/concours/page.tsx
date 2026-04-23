'use client'

import { useEffect, useState } from 'react'
import { Trophy, Calendar } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import { formatEurosFraction } from '@/lib/utils'
import type { Contest } from '@/types'

export default function ConcoursPage() {
  const { profile } = useAuth()
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('contests')
      .select('*')
      .in('status', ['live', 'upcoming'])
      .order('end_date', { ascending: true })
      .then(({ data }) => {
        setContests((data ?? []) as Contest[])
        setLoading(false)
      })
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="concours-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Concours</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          10 gagnants par concours. Abonnés Premium = x5 places automatiquement.
        </p>
      </header>

      {loading ? (
        <Card className="p-8 text-center text-sm text-[var(--text-muted)]">Chargement…</Card>
      ) : contests.length === 0 ? (
        <Card className="p-8 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-amber-400/60" />
          <p className="text-sm text-[var(--text-secondary)]">Aucun concours actif pour le moment.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contests.map((c) => (
            <Card key={c.id} className="p-6">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--text-primary)]">{c.title}</h3>
                  <p className="mt-1 text-xs uppercase tracking-wider text-amber-400">{c.type}</p>
                </div>
                <Trophy className="h-6 w-6 text-amber-400" />
              </div>
              {c.description && <p className="mb-3 text-sm text-[var(--text-secondary)]">{c.description}</p>}

              <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Calendar className="h-3 w-3" />
                <span>Tirage le {new Date(c.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
              </div>

              <div className="space-y-1.5">
                {c.prizes.slice(0, 5).map((p) => (
                  <div key={p.rank} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">
                      {p.rank}{p.rank === 1 ? 'er' : 'ème'} — {p.description}
                    </span>
                    <span className="font-semibold text-emerald-400">{formatEurosFraction(p.value_cents / 100)}</span>
                  </div>
                ))}
                {c.prizes.length > 5 && (
                  <div className="pt-1 text-xs text-[var(--text-muted)]">+ {c.prizes.length - 5} autres gagnants</div>
                )}
              </div>

              <div className="mt-4 rounded-xl bg-emerald-500/5 p-3 text-xs text-emerald-300">
                💰 Cagnotte totale : <strong>{formatEurosFraction(c.total_pool_cents / 100)}</strong>
                {profile?.subscription_plan === 'premium' && <span className="ml-2">· Tu as <strong>x5 places</strong> 🚀</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Coins, Trophy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatEurosFraction, formatPoints } from '@/lib/utils'
import type { Mission, MissionCompletion } from '@/types'

export default function MissionsPage() {
  const { profile, refetch } = useAuth()
  const [missions, setMissions] = useState<Mission[]>([])
  const [completions, setCompletions] = useState<MissionCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const sb = createClient()
    Promise.all([
      sb.from('missions').select('*').eq('active', true).order('reward_points', { ascending: false }),
      sb.from('mission_completions').select('*').eq('user_id', profile.id),
    ]).then(([m, c]) => {
      setMissions((m.data ?? []) as Mission[])
      setCompletions((c.data ?? []) as MissionCompletion[])
      setLoading(false)
    })
  }, [profile])

  async function complete(mission: Mission) {
    if (!profile) return
    setCompleting(mission.id)
    try {
      const res = await fetch('/api/missions/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mission_id: mission.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      toast.success(`+${mission.reward_points} pts ! Mission validée 🎉`)
      setCompletions((prev) => [
        ...prev,
        { id: data.completion_id, user_id: profile.id, mission_id: mission.id, status: 'validated', proof_url: null, reward_paid: true, reward_paid_at: new Date().toISOString(), created_at: new Date().toISOString() },
      ])
      refetch()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mission impossible'
      toast.error(msg)
    } finally {
      setCompleting(null)
    }
  }

  const completedIds = new Set(completions.filter((c) => c.status === 'validated').map((c) => c.mission_id))

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="missions-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Missions</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Gagne des points, des places aux concours et de l&apos;argent en réalisant des missions.
        </p>
      </header>

      {loading ? (
        <Card className="p-8 text-center text-sm text-[var(--text-muted)]">Chargement…</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {missions.map((m) => {
            const done = completedIds.has(m.id)
            return (
              <Card key={m.id} className="flex flex-col p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">{m.title}</h3>
                  {done && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      <Check className="h-3 w-3" /> Faite
                    </span>
                  )}
                </div>
                <p className="mb-3 text-sm text-[var(--text-secondary)]">{m.description}</p>
                <div className="mb-4 flex flex-wrap gap-2 text-xs">
                  {m.reward_points > 0 && (
                    <span className="rounded-full bg-[var(--purple)]/10 px-2 py-0.5 text-[var(--purple)]">
                      <Sparkles className="mr-1 inline h-3 w-3" />
                      {formatPoints(m.reward_points)}
                    </span>
                  )}
                  {m.reward_euros > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                      <Coins className="mr-1 inline h-3 w-3" />
                      {formatEurosFraction(m.reward_euros)}
                    </span>
                  )}
                  {m.reward_contest_places > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">
                      <Trophy className="mr-1 inline h-3 w-3" />
                      {m.reward_contest_places} place{m.reward_contest_places > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={done ? 'secondary' : 'primary'}
                  disabled={done || completing === m.id}
                  onClick={() => complete(m)}
                  className="mt-auto w-full"
                  data-testid={`mission-${m.id}`}
                >
                  {done ? 'Validée' : completing === m.id ? 'Validation…' : 'Valider'}
                </Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

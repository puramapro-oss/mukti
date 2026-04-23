'use client'

import { Check, Lock, Hourglass, Coins, ShieldAlert } from 'lucide-react'
import { MILESTONES, type MilestoneId } from '@/lib/constants'
import { cn } from '@/lib/utils'

type MilestoneStatus = 'pending' | 'credited' | 'locked' | 'unlocked' | 'denied_fraud' | 'denied_score'

export interface MilestoneSnapshot {
  milestone: MilestoneId
  status: MilestoneStatus
  amount_cents: number
  credited_at: string | null
  locked_until: string | null
  unlocked_at: string | null
}

interface Props {
  currentDays: number
  achieved: MilestoneSnapshot[]
}

function formatEur(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

function getBadge(status: MilestoneStatus, lockedUntil: string | null) {
  switch (status) {
    case 'unlocked':
      return { icon: Check, label: 'Disponible', color: 'text-[var(--accent,#10B981)]' }
    case 'locked':
      return {
        icon: Hourglass,
        label: lockedUntil ? `Libéré le ${shortDate(lockedUntil)}` : 'Verrouillé 30j',
        color: 'text-[var(--cyan,#06B6D4)]',
      }
    case 'credited':
      return { icon: Check, label: 'Validé', color: 'text-[var(--accent,#10B981)]' }
    case 'denied_fraud':
      return { icon: ShieldAlert, label: 'Vérification', color: 'text-red-400' }
    case 'denied_score':
      return { icon: Coins, label: 'Points', color: 'text-[var(--gold,#F59E0B)]' }
    default:
      return { icon: Lock, label: 'À venir', color: 'text-[var(--text-muted)]' }
  }
}

export default function MilestonePanel({ currentDays, achieved }: Props) {
  const bySlot: Record<MilestoneId, MilestoneSnapshot | undefined> = {
    J1: achieved.find(m => m.milestone === 'J1'),
    J7: achieved.find(m => m.milestone === 'J7'),
    J30: achieved.find(m => m.milestone === 'J30'),
    J90: achieved.find(m => m.milestone === 'J90'),
  }

  return (
    <section className="flex flex-col gap-4" data-testid="milestone-panel">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Paliers wallet
        </h3>
        <p className="text-xs text-[var(--text-muted)]">Verrouillés 30 jours (rétractation L221-28)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MILESTONES.map(m => {
          const snap = bySlot[m.id]
          const reached = !!snap && (snap.status === 'locked' || snap.status === 'credited' || snap.status === 'unlocked')
          const upcoming = currentDays < m.days
          const badge = snap ? getBadge(snap.status, snap.locked_until) : null

          return (
            <div
              key={m.id}
              className={cn(
                'flex flex-col gap-2 rounded-2xl border p-4 transition-all',
                reached
                  ? 'border-[var(--cyan,#06B6D4)]/40 bg-gradient-to-br from-[var(--cyan,#06B6D4)]/10 to-[var(--purple,#7C3AED)]/10'
                  : upcoming
                    ? 'border-[var(--border)] bg-white/[0.03]'
                    : 'border-[var(--border)] bg-white/5',
              )}
              data-testid={`milestone-${m.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden>
                  {m.emoji}
                </span>
                {badge && <badge.icon className={cn('h-4 w-4', badge.color)} />}
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{m.label}</p>
                <p className="text-2xl font-semibold text-[var(--text-primary)]">{formatEur(m.amount_cents)}</p>
              </div>
              {badge && <p className={cn('text-xs', badge.color)}>{badge.label}</p>}
              {!snap && upcoming && (
                <p className="text-xs text-[var(--text-muted)]">Jour&nbsp;{m.days}</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

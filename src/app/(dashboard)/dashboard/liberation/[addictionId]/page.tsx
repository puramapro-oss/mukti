import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ADDICTION_TYPES, MILESTONES, MODES_G2, type MilestoneId } from '@/lib/constants'
import { canRegenerateProgram, getLatestProgram } from '@/lib/programs'
import { getStreakState } from '@/lib/streaks'
import StreakCounter from '@/components/liberation/StreakCounter'
import MilestonePanel, { type MilestoneSnapshot } from '@/components/liberation/MilestonePanel'
import CheckinButton from '@/components/liberation/CheckinButton'
import RelapseButton from '@/components/liberation/RelapseButton'
import ProgramView from '@/components/liberation/ProgramView'
import type { Addiction } from '@/lib/addictions'

export const metadata: Metadata = {
  title: 'Ma libération — MUKTI',
}

export const dynamic = 'force-dynamic'

type PaymentMilestoneRow = {
  milestone: MilestoneId
  status: MilestoneSnapshot['status']
  amount_cents: number
  credited_at: string | null
  locked_until: string | null
  unlocked_at: string | null
}

export default async function AddictionDetailPage({
  params,
}: {
  params: Promise<{ addictionId: string }>
}) {
  const { addictionId } = await params
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/liberation/${addictionId}`)

  const { data: addictionRow } = await sb
    .from('addictions')
    .select('*')
    .eq('id', addictionId)
    .maybeSingle()

  if (!addictionRow) notFound()
  const addiction = addictionRow as Addiction

  const [state, currentProgram, regen, { data: milestoneRows }] = await Promise.all([
    getStreakState(addictionId),
    getLatestProgram(addictionId),
    canRegenerateProgram(addictionId),
    sb
      .from('payment_milestones')
      .select('milestone, status, amount_cents, credited_at, locked_until, unlocked_at')
      .eq('addiction_id', addictionId),
  ])

  const milestones = (milestoneRows ?? []) as PaymentMilestoneRow[]
  const meta = ADDICTION_TYPES.find(t => t.id === addiction.type)
  const label = addiction.custom_label || meta?.name || addiction.type

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <Link
        href="/dashboard/liberation"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux libérations
      </Link>

      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-gradient-to-br from-white/10 to-white/5 text-4xl"
            style={{ borderColor: meta?.color + '40' }}
            aria-hidden
          >
            {meta?.icon ?? '✨'}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">Libération</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-4xl">
              {label}
            </h1>
            <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span>Sévérité {addiction.severity}/5</span>
              <span>·</span>
              <span>Objectif {addiction.goal === 'stop' ? 'arrêt' : 'réduction'}</span>
              {addiction.triggers.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {addiction.triggers.length} déclencheur{addiction.triggers.length > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-[var(--border)] bg-white/[0.03] p-6">
          <StreakCounter
            currentDays={state.streak?.current_days ?? 0}
            bestDays={state.streak?.best_days ?? 0}
            nextMilestone={state.next_milestone}
            daysAway={state.next_milestone_days_away}
          />
          <div className="flex w-full flex-col gap-2">
            <CheckinButton addictionId={addictionId} lastCheckinAt={state.streak?.last_checkin_at ?? null} />
            <RelapseButton addictionId={addictionId} currentDays={state.streak?.current_days ?? 0} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <MilestonePanel
            currentDays={state.streak?.current_days ?? 0}
            achieved={milestones.map(m => ({
              milestone: m.milestone,
              status: m.status,
              amount_cents: m.amount_cents,
              credited_at: m.credited_at,
              locked_until: m.locked_until,
              unlocked_at: m.unlocked_at,
            }))}
          />

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Modes anti-pulsion immédiats
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MODES_G2.map(m => (
                <Link
                  key={m.id}
                  href={`/dashboard/liberation/${addictionId}/mode/${m.id}`}
                  className="group flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-white/5 p-4 transition-all hover:border-[var(--cyan)]/60 hover:bg-white/10"
                  data-testid={`mode-${m.id}`}
                >
                  <span className="text-2xl" aria-hidden>
                    {m.emoji}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{m.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{m.desc}</p>
                  </div>
                  {m.duration_sec > 0 && (
                    <span className="mt-auto text-xs text-[var(--cyan)]">{m.duration_sec}s</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>

      <ProgramView
        addictionId={addictionId}
        currentProgram={currentProgram}
        canRegenerate={regen.allowed}
        nextRegenAt={regen.next_available_at ?? null}
      />

      {addiction.triggers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Tes déclencheurs identifiés
          </h3>
          <div className="flex flex-wrap gap-2">
            {addiction.triggers.map(t => (
              <span
                key={t}
                className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1 text-sm text-[var(--text-secondary)]"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Referencing MILESTONES ensures tree-shake keeps it if needed — pure side-effect free */}
      <p className="sr-only" aria-hidden>
        {MILESTONES.length} paliers
      </p>
    </div>
  )
}

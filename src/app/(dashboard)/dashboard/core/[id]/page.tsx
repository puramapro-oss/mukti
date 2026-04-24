import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Clock, MapPin, Radio } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import {
  getEventById,
  getEventSessions,
  computeCurrentPhase,
} from '@/lib/core-events'
import { CORE_FORMATS, CORE_PHASES, type CoreFormat } from '@/lib/constants'
import COREIntentionDisplay from '@/components/core/COREIntentionDisplay'
import COREPhaseIndicator from '@/components/core/COREPhaseIndicator'
import COREPulseVisualizer from '@/components/core/COREPulseVisualizer'
import COREJoinButton from '@/components/core/COREJoinButton'

export const metadata: Metadata = {
  title: 'Événement C.O.R.E. — MUKTI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function COREEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/core/${id}`)

  const event = await getEventById(id)
  if (!event || event.status === 'rejected') notFound()

  const [sessions, { data: profile }] = await Promise.all([
    getEventSessions(id),
    sb.schema('mukti').from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle(),
  ])
  const profileId = (profile as { id: string } | null)?.id ?? ''

  let joined = false
  if (profileId) {
    const srv = createServiceClient()
    const { data: part } = await srv
      .schema('mukti')
      .from('core_event_participants')
      .select('user_id, left_at')
      .eq('event_id', id)
      .eq('user_id', profileId)
      .maybeSingle()
    const partRow = part as { left_at: string | null } | null
    joined = !!partRow && partRow.left_at === null
  }

  const momentZ = new Date(event.moment_z_at)
  const phase = computeCurrentPhase(momentZ)
  const fmt = CORE_FORMATS.find(f => f.id === event.format) ?? CORE_FORMATS[0]!
  const phaseDef =
    CORE_PHASES.find(p => p.id === phase) ?? null
  const isLive = event.status === 'live' || phase === 'pulse' || phase === 'silence'

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/dashboard/core"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            C.O.R.E.
          </Link>
          {joined && isLive && (
            <Link
              href={`/dashboard/core/${id}/live`}
              data-testid="core-live-room-cta"
              className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 border border-rose-400/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-rose-200 transition-colors hover:bg-rose-500/30"
            >
              <Radio className="h-3.5 w-3.5" />
              Rejoindre la salle live
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-4xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/55">
          <span className="text-2xl">{fmt.emoji}</span>
          <span>{fmt.name}</span>
          <span className="text-white/25">·</span>
          <span>Gravité {event.severity}/5</span>
          {event.region && (
            <>
              <span className="text-white/25">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.region}
              </span>
            </>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">{event.title_fr}</h1>

        <div className="mt-8">
          <COREIntentionDisplay intention={event.intention_fr} live={isLive} />
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
              Moment Z
            </div>
            <div className="flex items-center gap-2 text-base text-white">
              <Clock className="h-4 w-4 text-[#DDD6FE]" />
              <time dateTime={event.moment_z_at}>
                {momentZ.toLocaleString('fr-FR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </div>
          </div>
          <COREJoinButton eventId={id} initialJoined={joined} />
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            Phase en cours
          </div>
          <div className="mt-4">
            <COREPhaseIndicator currentPhase={phase} />
          </div>
          {phaseDef && (
            <p className="mt-4 text-sm text-white/70">
              <span className="text-white">{phaseDef.name}</span> —{' '}
              {phaseDef.description_fr}
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_260px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
              Trilogie Now / 24h / 7 jours
            </div>
            <ul className="mt-4 space-y-3">
              {sessions.map(s => (
                <li key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div>
                    <div className="text-sm text-white">
                      {s.kind === 'now' ? 'CORE-NOW' : s.kind === 'h24' ? 'CORE-24h' : 'CORE-7j'}
                    </div>
                    <div className="text-xs text-white/55">
                      {new Date(s.scheduled_at).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/70">
                    {s.current_phase}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
              Présence collective
            </div>
            <div className="mt-4">
              <COREPulseVisualizer participantsCount={event.participants_count} live={isLive} />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

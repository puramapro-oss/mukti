import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Radio } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { getEventById, computeCurrentPhase } from '@/lib/core-events'
import { CORE_FORMATS, type CoreFormat } from '@/lib/constants'
import COREIntentionDisplay from '@/components/core/COREIntentionDisplay'
import COREPhaseIndicator from '@/components/core/COREPhaseIndicator'
import COREPulseVisualizer from '@/components/core/COREPulseVisualizer'

export const metadata: Metadata = {
  title: 'Salle Live C.O.R.E. — MUKTI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function COREEventLivePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/core/${id}/live`)

  const event = await getEventById(id)
  if (!event || !['scheduled', 'live', 'finished'].includes(event.status)) {
    notFound()
  }

  // Ownership check : must be participant
  const srv = createServiceClient()
  const { data: profile } = await srv
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const profileId = (profile as { id: string } | null)?.id
  if (!profileId) notFound()
  const { data: part } = await srv
    .schema('mukti')
    .from('core_event_participants')
    .select('left_at')
    .eq('event_id', id)
    .eq('user_id', profileId)
    .maybeSingle()
  const partRow = part as { left_at: string | null } | null
  if (!partRow || partRow.left_at !== null) {
    redirect(`/dashboard/core/${id}`)
  }

  const momentZ = new Date(event.moment_z_at)
  const phase = computeCurrentPhase(momentZ)
  const fmt = CORE_FORMATS.find(f => f.id === event.format) ?? CORE_FORMATS[0]!
  const isLive = phase === 'silence' || phase === 'pulse' || phase === 'integration'

  return (
    <main
      className="min-h-screen bg-[#0A0A0F] pb-20 text-white"
      data-testid="core-live-room"
    >
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href={`/dashboard/core/${id}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs uppercase tracking-widest text-rose-200">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {isLive ? 'Live' : 'Pré-Live'}
          </div>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-3xl px-6">
        <div className="text-center text-xs uppercase tracking-[0.25em] text-white/55">
          {fmt.emoji} {fmt.name} · {event.title_fr}
        </div>

        <div className="mt-8">
          <COREIntentionDisplay intention={event.intention_fr} live={isLive} />
        </div>

        <div className="mt-10 flex justify-center">
          <COREPulseVisualizer participantsCount={event.participants_count} live={isLive} />
        </div>

        <div className="mt-10">
          <COREPhaseIndicator currentPhase={phase} />
        </div>

        <p className="mt-8 text-center text-sm text-white/60">
          Pose tes mains sur ton cœur. Respire lentement. Laisse l&apos;intention t&apos;habiter.
          Au Moment Z, le monde entier pulse avec toi.
        </p>
      </section>
    </main>
  )
}

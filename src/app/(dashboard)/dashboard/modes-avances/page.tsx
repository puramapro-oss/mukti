import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Grid3x3 } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdvancedModesGrid from '@/components/modes-avances/AdvancedModesGrid'
import { ADVANCED_MODES } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Modes avancés anti-addiction — MUKTI',
  description:
    '9 modes révolutionnaires contre l\'addiction : 4 actifs (Rituel 7s, Boucle Urgence, Exorcisme, Boîte Noire) et 5 en préparation.',
}

export const dynamic = 'force-dynamic'

export default async function ModesAvancesPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/modes-avances')

  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('notifs')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const profileRow = profile as { notifs: Record<string, unknown> | null } | null
  const notifs = profileRow?.notifs ?? {}
  const notifiedModes = Array.isArray(
    (notifs as Record<string, unknown>).advanced_modes_notify
  )
    ? ((notifs as Record<string, unknown>).advanced_modes_notify as string[])
    : []

  const activeCount = ADVANCED_MODES.filter(m => m.status === 'active').length
  const teaserCount = ADVANCED_MODES.length - activeCount

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-5xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
          <Grid3x3 className="h-3.5 w-3.5 text-[#A855F7]" />
          <span>{activeCount} actifs · {teaserCount} en préparation</span>
        </div>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          {activeCount} modes{' '}
          <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
            révolutionnaires
          </span>{' '}
          contre l&apos;addiction
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
          Chaque mode est pensé pour un moment précis. Micro-geste quotidien, camouflage
          social, séance cathartique ou lecture de ton schéma. Active celui qui correspond à
          ton contexte.
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-5xl px-6">
        <AdvancedModesGrid initialNotifiedModes={notifiedModes} />
      </section>

      <section className="mx-auto mt-12 max-w-5xl px-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-5 backdrop-blur-xl">
          <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/45">
            Bientôt
          </div>
          <p className="mt-2 text-sm text-white/70">
            Les 5 modes en Phase Avancée s&apos;appuient sur des technos en cours
            d&apos;intégration (IA comportementale, MediaPipe avancé, capteurs olfactifs
            virtuels). Clique{' '}
            <em className="font-medium text-white">Notifie-moi</em> sur chacun — tu seras
            prévenu·e en premier à leur sortie.
          </p>
        </div>
      </section>
    </main>
  )
}

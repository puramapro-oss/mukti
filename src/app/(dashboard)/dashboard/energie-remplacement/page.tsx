import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Battery } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import EnergyChannelSelector from '@/components/mode16/EnergyChannelSelector'
import { ENERGY_REPLACEMENT_CHANNELS } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Énergie de Remplacement — MUKTI',
  description:
    'Comble le vide avec motivation, calme, confiance, énergie ou concentration.',
}

export const dynamic = 'force-dynamic'

export default async function EnergiePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/energie-remplacement')

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/dashboard/modes-avances"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Modes
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-4xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/55">
          <Battery className="h-3.5 w-3.5 text-[#10b981]" />
          Mode 16 · {ENERGY_REPLACEMENT_CHANNELS.length} canaux
        </div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
          Énergie de{' '}
          <span className="bg-gradient-to-r from-[#10b981] to-[#7c3aed] bg-clip-text text-transparent">
            remplacement
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          Quand l&apos;envie arrive, comble le vide — motivation, calme, confiance, énergie ou
          concentration. Chaque canal utilise une fréquence Solfeggio spécifique.
        </p>

        <div className="mt-8">
          <EnergyChannelSelector />
        </div>
      </section>
    </main>
  )
}

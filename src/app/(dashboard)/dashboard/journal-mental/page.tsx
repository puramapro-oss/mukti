import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Mic2 } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listEntries } from '@/lib/mental-journal'
import MentalJournalRecorder from '@/components/mode20/MentalJournalRecorder'

export const metadata: Metadata = {
  title: 'Journal Mental Auto — MUKTI',
  description:
    'Parle 1-3 minutes, l\'IA analyse ton état mental et anticipe ton risque de rechute.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function JournalMentalPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/journal-mental')

  const entries = await listEntries(7)

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/dashboard/modes-avances"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Modes
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-3xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/55">
          <Mic2 className="h-3.5 w-3.5 text-[#7c3aed]" />
          Mode 20
        </div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
          Journal{' '}
          <span className="bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] bg-clip-text text-transparent">
            mental auto
          </span>
        </h1>
        <p className="mt-3 text-sm text-white/70">
          Parle comme tu veux, 1 à 3 minutes. Whisper transcrit, l&apos;IA détecte ton mood, ton
          énergie, ton anxiété et ton risque de rechute. Confidentiel.
        </p>

        <div className="mt-8">
          <MentalJournalRecorder initialEntries={entries} />
        </div>
      </section>
    </main>
  )
}

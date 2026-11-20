import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Mic2 } from 'lucide-react'
import { getJournalContext, listEntries } from '@/lib/mental-journal'
import { JournalError, type MentalJournalEntry } from '@/lib/mental-journal-contract'
import MentalJournalRecorder from '@/components/mode20/MentalJournalRecorder'

export const metadata: Metadata = {
  title: 'Mon journal — MUKTI',
  description: 'Écris ou dicte ton journal personnel et choisis, si tu le souhaites, une réflexion facultative.',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function JournalMentalPage() {
  let entries: MentalJournalEntry[] = []
  let initialError: string | null = null
  try {
    const context = await getJournalContext()
    entries = await listEntries(30, context)
  } catch (error) {
    if (error instanceof JournalError && error.status === 401) redirect('/login?next=/dashboard/journal-mental')
    initialError = error instanceof JournalError ? error.message : 'Le journal ne peut pas être chargé pour le moment.'
  }
  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/dashboard/modes-avances" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 hover:text-white">
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />Modes
          </Link>
        </div>
      </header>
      <section className="mx-auto mt-8 max-w-3xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/55"><Mic2 aria-hidden="true" className="h-3.5 w-3.5 text-violet-300" />Journal personnel</div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">Un moment pour toi</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/75">Tes mots, à ton rythme. Écris directement ou choisis une dictée audio. Tu décides séparément si une IA peut proposer des pistes de réflexion, et tu peux supprimer tes entrées.</p>
        <div className="mt-8"><MentalJournalRecorder initialEntries={entries} initialError={initialError} /></div>
      </section>
    </main>
  )
}

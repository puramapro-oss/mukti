import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Leaf } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getRecognitionOverview, RecognitionError } from '@/lib/mystery-rewards'
import type { RecognitionOverview } from '@/lib/daily-recognition'
import MysteryChest from '@/components/mode18/MysteryChest'

export const metadata: Metadata = {
  title: 'Ma journée compte — MUKTI',
  description: 'Pratique, repos ou journée sans activité : une reconnaissance gratuite, à ton rythme.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function RecompensesPage() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/recompenses')

  let initialOverview: RecognitionOverview | null = null
  let initialError: string | null = null
  try {
    initialOverview = await getRecognitionOverview()
  } catch (error) {
    initialError = error instanceof RecognitionError ? error.message : 'Historique indisponible. Réessaie plus tard.'
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/dashboard/modes-avances"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 transition-colors hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Modes
          </Link>
        </div>
      </header>
      <section className="mx-auto mt-8 max-w-2xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/55">
          <Leaf className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
          À ton rythme
        </div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">Ma journée compte</h1>
        <div className="mt-8">
          <MysteryChest initialOverview={initialOverview} initialError={initialError} />
        </div>
      </section>
    </main>
  )
}

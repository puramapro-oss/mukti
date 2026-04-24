import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Droplets } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { todayStatus } from '@/lib/minimal-ritual'
import MinimalHabitsList from '@/components/mode19/MinimalHabitsList'

export const metadata: Metadata = {
  title: 'Rituel Minimaliste — MUKTI',
  description: '8 micro-habitudes invisibles. Pour les jours sans motivation.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function RituelMinimalistePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/rituel-minimaliste')

  const initialStatus = await todayStatus()
  const tickedCount = initialStatus.filter(s => s.ticked_today).length

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
          <Droplets className="h-3.5 w-3.5 text-[#06b6d4]" />
          Mode 19 · {tickedCount}/{initialStatus.length} aujourd&apos;hui
        </div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
          Rituel{' '}
          <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent">
            minimaliste
          </span>
        </h1>
        <p className="mt-3 text-sm text-white/70">
          8 micro-habitudes invisibles (10-60s). Même dans tes pires jours, une respiration
          consciente, une gratitude — ça compte.
        </p>

        <div className="mt-8">
          <MinimalHabitsList initialStatus={initialStatus} />
        </div>
      </section>
    </main>
  )
}

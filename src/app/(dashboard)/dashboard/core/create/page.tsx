import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CoreCreateForm from '@/components/core/CoreCreateForm'
import { CORE_COMMUNITY_TRUST_MIN } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Créer un événement C.O.R.E. — MUKTI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function COREEventCreatePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/core/create')

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/dashboard/core"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            C.O.R.E.
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-3xl px-6">
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          Créer un{' '}
          <span className="bg-gradient-to-r from-[#7c3aed] to-[#06b6d4] bg-clip-text text-transparent">
            événement C.O.R.E.
          </span>
        </h1>
        <p className="mt-3 text-sm text-white/65">
          Ouvre un Moment Z synchronisé pour une crise, un soin collectif ou une
          synchronisation planétaire. Trust score minimum : {CORE_COMMUNITY_TRUST_MIN}/100 pour
          éviter les abus.
        </p>

        <div className="mt-8">
          <CoreCreateForm />
        </div>
      </section>
    </main>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CustomAffirmationPanel from '@/components/reprogrammation/CustomAffirmationPanel'

export const metadata: Metadata = {
  title: 'Mes affirmations perso — MUKTI',
  description:
    'Crée tes propres affirmations. Demande 5 suggestions IA par catégorie. Max 100 / catégorie. Elles se mêlent aux 914 affirmations système.',
}

export const dynamic = 'force-dynamic'

export default async function MesAffirmationsPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/subconscient/mes-affirmations')

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/dashboard/subconscient"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Reprogrammation
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-3xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Mes affirmations perso</span>
        </div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
          Écris ce qui{' '}
          <span className="bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] bg-clip-text text-transparent">
            résonne pour toi
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/70">
          Elles se mêlent aux 914 affirmations système dans tes sessions. Tu peux en créer 100 par catégorie.
          L&apos;IA peut t&apos;en suggérer 5 adaptées — tu choisis celles que tu gardes.
        </p>
      </section>

      <section className="mx-auto mt-8 max-w-3xl px-6">
        <CustomAffirmationPanel />
      </section>
    </main>
  )
}

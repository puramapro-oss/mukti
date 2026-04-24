import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NamaAidantChat } from '@/components/accompagnants/NamaAidantChat'

export const metadata: Metadata = {
  title: 'NAMA-Aidant — Accompagnants — MUKTI',
  description: 'Coach IA dédié à toi, l\'aidant·e. Un espace d\'écoute sans jugement.',
}

export const dynamic = 'force-dynamic'

export default async function NamaAidantPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/accompagnants/nama-aidant')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/accompagnants"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Retour à l'espace Accompagnants
        </Link>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-300">
          Conversation privée
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-white">
          NAMA-Aidant
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
          Écoute sans jugement. Tutoie tes émotions. Ce que tu dis ici reste avec toi.
        </p>
      </header>

      <NamaAidantChat />

      <p className="text-xs text-white/40">
        NAMA n'est pas un thérapeute. Si tu traverses une détresse grave, compose le 3114 (gratuit, 24/7 en France).
      </p>
    </div>
  )
}

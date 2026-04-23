import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listSpecies } from '@/lib/ar'
import ArSoinRoom from '@/components/ar/ArSoinRoom'

export const metadata: Metadata = {
  title: 'Soin énergétique AR — MUKTI',
  description: 'Pose tes mains fantômes sur ton corps, respire, reçois. Choisis une espèce qui te correspond.',
}

export const dynamic = 'force-dynamic'

export default async function ArSoinPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/ar/soin')

  const speciesRes = await listSpecies()
  const species = speciesRes.ok ? speciesRes.species : []

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/dashboard/ar"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour au miroir
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">Soin pour moi</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Dirige tes propres mains sur toi
        </h1>
        <p className="mt-1 max-w-xl text-sm text-white/55">
          Choisis une forme. Respire. Pose tes mains fantômes là où tu en as besoin. Rien n&apos;est enregistré — tout reste sur ton appareil.
        </p>
      </header>
      <ArSoinRoom species={species} />
    </div>
  )
}

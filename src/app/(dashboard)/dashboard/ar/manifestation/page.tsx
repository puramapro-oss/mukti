import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listBeacons, listSpecies } from '@/lib/ar'
import ArManifestationRoom from '@/components/ar/ArManifestationRoom'

export const metadata: Metadata = {
  title: 'Manifestation AR — MUKTI',
  description: 'Envoie ton énergie — à un refuge, à une ONG, à un proche, à la Terre. Ton intention prend un chemin visible.',
}

export const dynamic = 'force-dynamic'

export default async function ArManifestationPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/ar/manifestation')

  const [beaconsRes, speciesRes] = await Promise.all([listBeacons(), listSpecies()])
  const beacons = beaconsRes.ok ? beaconsRes.beacons : []
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--purple)]">Manifestation</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Envoyer de l&apos;énergie</h1>
        <p className="mt-1 max-w-xl text-sm text-white/55">
          Choisis une cible, prends une forme, émets le rayon. Ton intention voyage — même symboliquement,
          elle agit sur toi.
        </p>
      </header>
      <ArManifestationRoom beacons={beacons} species={species} />
    </div>
  )
}

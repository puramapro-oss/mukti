import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCeremony } from '@/lib/ar-ceremony'
import ArCeremonyRoom from '@/components/ar/ArCeremonyRoom'

interface Props {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: 'Cérémonie — MUKTI' }
  const ceremony = await getCeremony(id)
  if (!ceremony) return { title: 'Cérémonie — MUKTI' }
  return {
    title: `${ceremony.title} — MUKTI`,
    description: ceremony.description ?? 'Cérémonie Moment Z synchronisée.',
    robots: 'noindex',
  }
}

export default async function ArCeremonyDetailPage({ params }: Props) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/ar/ceremony/${id}`)

  const ceremony = await getCeremony(id)
  if (!ceremony) notFound()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/dashboard/ar/ceremony"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Toutes les cérémonies
      </Link>
      <ArCeremonyRoom ceremonyId={ceremony.id} initial={ceremony} />
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CIRCLE_CATEGORIES, type CircleCategoryId } from '@/lib/constants'
import CircleCreateWizard from '@/components/cercles/CircleCreateWizard'

export const metadata: Metadata = {
  title: 'Créer un cercle — MUKTI',
  description: 'Ouvre ton cercle d\'intention. 14 catégories, 8 modes de guidage, 2 à des milliers d\'âmes.',
}

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function CreateCirclePage({ searchParams }: Props) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/cercles/create')

  const params = await searchParams
  const initialCategory = params.category && CIRCLE_CATEGORIES.some((c) => c.id === params.category)
    ? (params.category as CircleCategoryId)
    : undefined

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href={initialCategory ? `/dashboard/cercles/${initialCategory}` : '/dashboard/cercles'}
        data-testid="back-from-create"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">Création</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-white">Ouvrir un cercle d&apos;intention</h1>
        <p className="mt-2 max-w-xl text-sm text-white/60">
          5 étapes. Tu définis la fréquence, la taille, le guidage — le cercle s&apos;ouvrira exactement comme tu l&apos;as rêvé.
        </p>
      </header>
      <CircleCreateWizard initialCategory={initialCategory} />
    </div>
  )
}

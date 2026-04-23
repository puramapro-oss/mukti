import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PostSessionForm from '@/components/cercles/PostSessionForm'
import { CIRCLE_CATEGORIES } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Clôture de session — MUKTI',
  description: 'Laisse un message après ta session de cercle.',
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PostSessionPage({ params }: Props) {
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/cercles/post-session/${id}`)

  const { data: circle } = await sb
    .from('circles')
    .select('id, title, category, status')
    .eq('id', id)
    .maybeSingle()

  if (!circle) notFound()

  const cat = CIRCLE_CATEGORIES.find((c) => c.id === (circle as { category: string }).category)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link
        href="/dashboard/cercles"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux cercles
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: cat?.color ?? '#7C3AED' }}>
          Clôture de session
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Merci d&apos;avoir été là
        </h1>
        <p className="mt-1 text-sm text-white/55">
          {cat?.emoji} {(circle as { title: string }).title}
        </p>
      </header>
      <PostSessionForm circleId={id} />
    </div>
  )
}

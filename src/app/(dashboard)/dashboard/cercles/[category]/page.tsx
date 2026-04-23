import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listOpenCircles } from '@/lib/circles'
import { CIRCLE_CATEGORIES, type CircleCategoryId } from '@/lib/constants'
import CircleListItem from '@/components/cercles/CircleListItem'

interface Props {
  params: Promise<{ category: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const cat = CIRCLE_CATEGORIES.find((c) => c.id === category)
  if (!cat) return { title: 'Cercle — MUKTI' }
  return {
    title: `Cercles — ${cat.name} — MUKTI`,
    description: `Rejoins ou crée un cercle d'intention ${cat.name.toLowerCase()}. Soin collectif synchronisé.`,
  }
}

export const dynamic = 'force-dynamic'

export default async function CircleCategoryPage({ params }: Props) {
  const { category } = await params
  const cat = CIRCLE_CATEGORIES.find((c) => c.id === category)
  if (!cat) notFound()

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/cercles/${category}`)

  const circles = await listOpenCircles({
    category: cat.id as CircleCategoryId,
    status: ['open', 'live'],
    limit: 50,
  })

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/cercles"
          data-testid="back-cercles"
          className="inline-flex w-fit items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Toutes les catégories
        </Link>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
              style={{ backgroundColor: hexAlpha(cat.color, 0.15) }}
              aria-hidden
            >
              {cat.emoji}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: cat.color }}>
                Cercles d&apos;intention
              </p>
              <h1 className="mt-1 text-3xl font-semibold leading-tight text-white">{cat.name}</h1>
              <p className="mt-1 text-sm text-white/55">
                {circles.length === 0
                  ? 'Aucun cercle pour le moment — ouvre la porte.'
                  : `${circles.length} cercle${circles.length > 1 ? 's' : ''} ouvert${circles.length > 1 ? 's' : ''} à toi.`}
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/cercles/create?category=${cat.id}`}
            data-testid="create-in-category"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Créer un cercle {cat.name.toLowerCase()}
          </Link>
        </div>
      </div>

      {circles.length === 0 ? (
        <section className="flex flex-col items-center gap-5 rounded-3xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{ backgroundColor: hexAlpha(cat.color, 0.12) }}
          >
            {cat.emoji}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Sois le premier</h2>
            <p className="mt-2 max-w-md text-sm text-white/60">
              Ouvre un cercle {cat.name.toLowerCase()}. Choisis la taille (2 à des milliers), le mode de guidage,
              la durée par personne. Les âmes compatibles te rejoindront.
            </p>
          </div>
          <Link
            href={`/dashboard/cercles/create?category=${cat.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Ouvrir mon cercle
          </Link>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {circles.map((c) => (
            <CircleListItem key={c.id} circle={c} />
          ))}
        </section>
      )}
    </div>
  )
}

function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

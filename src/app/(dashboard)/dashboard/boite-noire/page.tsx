import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BookLock, Plus, Sparkles } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUserActiveAddictions } from '@/lib/addictions'
import { ADDICTION_TYPES } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Boîte Noire — MUKTI',
  description:
    'Révèle ton schéma : enregistre chaque déclencheur (où, quand, avec qui, quoi) et laisse Claude en extraire ton pattern.',
}

export const dynamic = 'force-dynamic'

function getTypeMeta(type: string) {
  return ADDICTION_TYPES.find(t => t.id === type)
}

export default async function BoiteNoireHubPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/boite-noire')

  const addictions = await getUserActiveAddictions()

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-4xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
          <BookLock className="h-3.5 w-3.5 text-[#A855F7]" />
          <span>Mode 13 · Boîte Noire</span>
        </div>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          Révèle{' '}
          <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
            ton schéma secret
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
          Chaque fois que l&apos;envie monte — tu enregistres où, quand, avec qui, quoi. Sans
          jugement. Après 5 entrées, Claude te montre le pattern que tu ne voyais pas.
        </p>

        {addictions.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-gradient-to-br from-[#7C3AED]/10 to-transparent p-6 backdrop-blur-xl sm:p-8">
            <p className="text-sm text-white/75">
              La Boîte Noire fonctionne par addiction déclarée. Commence par déclarer une
              addiction pour t&apos;y rattacher.
            </p>
            <Link
              href="/dashboard/liberation/declare"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/15 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#7C3AED]/25"
            >
              <Plus className="h-4 w-4" />
              Déclarer une addiction
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {addictions.map(a => {
              const meta = getTypeMeta(a.type)
              const displayName = a.custom_label || meta?.name || a.type
              const emoji = meta?.icon ?? '•'
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/boite-noire/${a.id}`}
                  data-testid="boite-noire-addiction-card"
                  className="group flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all hover:border-[#A855F7]/40 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-[10px] uppercase tracking-widest text-white/40">
                      Sévérité {a.severity}/5
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-white">{displayName}</h2>
                    <p className="mt-1 text-xs text-white/50">
                      Objectif : {a.goal === 'stop' ? 'Libération totale' : 'Réduire'}
                    </p>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#C4B5FD] transition-colors group-hover:text-[#DDD6FE]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Ouvrir la Boîte Noire →
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="mx-auto mt-14 max-w-4xl px-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          Les 4 dimensions capturées
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { title: 'Où', body: '6 lieux : maison, bureau, transport, café/bar, extérieur, autre. Jamais de GPS.' },
            { title: 'Qui', body: '6 contextes : seul·e, famille, collègues, ami·e·s, partenaire, inconnu·e·s.' },
            { title: 'Quoi', body: 'La phrase libre qui décrit ce qui a déclenché (2-500 c.).' },
            { title: 'Intensité', body: 'Slider 1-10 + émotion courte facultative + statut résisté/cédé.' },
          ].map(d => (
            <div
              key={d.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
            >
              <div className="text-sm font-medium text-[#DDD6FE]">{d.title}</div>
              <p className="mt-2 text-xs leading-relaxed text-white/55">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-4xl px-6">
        <Link
          href="/dashboard/modes-avances"
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-[#7C3AED]/10 to-transparent p-5 backdrop-blur-xl transition-colors hover:bg-white/[0.04]"
        >
          <div>
            <div className="text-sm font-medium text-white">Explorer les modes avancés</div>
            <p className="mt-1 text-xs text-white/55">
              4 actifs + 5 à venir. Parfum Virtuel, Prédicteur d&apos;Envie, Hypnose Mouvement,
              Hologramme, Armure.
            </p>
          </div>
          <span className="text-xl text-white/50 transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </section>
    </main>
  )
}

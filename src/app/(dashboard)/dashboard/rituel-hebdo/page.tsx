import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Sparkles, Calendar } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ensureCurrentWeek, getMyRituelHistory, themeMetadata } from '@/lib/rituel-hebdo'
import { RituelHebdoClient } from '@/components/rituel-hebdo/RituelHebdoClient'

export const metadata: Metadata = {
  title: 'Rituel hebdomadaire — MUKTI',
  description: 'Chaque semaine, un thème pour le monde. Rejoins des milliers d\'autres dans cette intention commune.',
}

export const dynamic = 'force-dynamic'

export default async function RituelHebdoPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/rituel-hebdo')

  const [week, history] = await Promise.all([
    ensureCurrentWeek(),
    getMyRituelHistory(10),
  ])
  const meta = themeMetadata(week.theme_slug)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: meta.color }}>
          Rituel mondial — semaine {week.week_iso}
        </p>
        <h1
          className="mt-2 text-4xl font-semibold leading-tight text-white"
          data-testid="rituel-theme-title"
        >
          {meta.title_fr}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
          Cette semaine, des milliers d'humains tiennent la même intention. Dix minutes suffisent.
          Ton souffle rejoint le leur.
        </p>
      </header>

      <RituelHebdoClient
        themeColor={meta.color}
        themeSlug={meta.title_fr}
        weekIso={week.week_iso}
        participantsCount={week.participants_count}
        totalMinutes={week.total_minutes}
      />

      <section aria-labelledby="cycle-title" className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-white/50" aria-hidden="true" />
          <h2 id="cycle-title" className="text-sm font-semibold text-white">Cycle de 7 semaines</h2>
        </div>
        <p className="mt-2 text-xs text-white/50">
          Le rituel tourne : chaque semaine aborde une énergie différente, toujours dans le même ordre.
        </p>
        <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            { slug: 'depolluer', label: '1 · Dépolluer' },
            { slug: 'paix', label: '2 · Paix' },
            { slug: 'amour', label: '3 · Amour' },
            { slug: 'pardon', label: '4 · Pardon' },
            { slug: 'gratitude', label: '5 · Gratitude' },
            { slug: 'abondance', label: '6 · Abondance' },
            { slug: 'conscience', label: '7 · Conscience' },
          ].map(t => (
            <li
              key={t.slug}
              className={`rounded-2xl border px-3 py-2 text-xs ${
                week.theme_slug === t.slug
                  ? 'border-white/40 bg-white/[0.06] text-white'
                  : 'border-white/10 text-white/50'
              }`}
            >
              {t.label}
            </li>
          ))}
        </ol>
      </section>

      {history.length > 0 && (
        <section aria-labelledby="history-title">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-white/50" aria-hidden="true" />
            <h2 id="history-title" className="text-lg font-semibold text-white">Tes dernières semaines</h2>
          </div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {history.map(h => {
              const m = themeMetadata(h.theme_slug)
              return (
                <li
                  key={`${h.week_iso}-${h.created_at}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl"
                >
                  <p className="text-xs uppercase tracking-[0.16em]" style={{ color: m.color }}>
                    {h.week_iso} · {m.title_fr}
                  </p>
                  <p className="mt-2 text-sm text-white/80">{h.minutes_practiced} min pratiquées</p>
                  {h.intention_text && (
                    <p className="mt-2 text-xs italic text-white/55">« {h.intention_text} »</p>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}

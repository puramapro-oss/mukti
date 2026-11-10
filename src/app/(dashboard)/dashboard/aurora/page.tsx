import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { AURORA_VARIANTS, AURORA_LEVELS, AURORA_PHASES } from '@/lib/constants/aurora'
import WellbeingCheckin from '@/components/wellbeing/WellbeingCheckin'
import WellbeingFeedback from '@/components/wellbeing/WellbeingFeedback'

export const metadata: Metadata = {
  title: 'AURORA — respiration guidée · MUKTI',
  description: 'Quatre parcours de respiration guidée, avec pauses libres et retours facultatifs.',
}
export const dynamic = 'force-dynamic'

export default async function AuroraHubPage() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/aurora')
  const { data: profile, error: profileError } = await sb.schema('mukti').from('profiles')
    .select('id').eq('auth_user_id', user.id).maybeSingle()
  const summary = profile?.id && !profileError
    ? await createServiceClient().schema('mukti').from('aurora_streaks')
      .select('current_level, total_minutes, total_sessions').eq('user_id', profile.id).maybeSingle()
    : { data: null, error: profileError ?? { message: 'Profil indisponible' } }
  const level = AURORA_LEVELS.find((item) => item.id === summary.data?.current_level) ?? AURORA_LEVELS[0]

  return <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
    <header className="mx-auto max-w-5xl px-6 pt-12">
      <p className="text-xs uppercase tracking-widest text-white/50">Respiration guidée</p>
      <h1 className="mt-3 text-4xl font-light">AURORA</h1>
      <p className="mt-3 max-w-2xl text-white/70">Choisis une pause adaptée à ton envie et au temps dont tu disposes. Respire sans forcer ; tu peux interrompre la séance à tout moment.</p>
      <p className="mt-2 max-w-2xl text-sm text-white/55">Le mode Soft, sans rétention, est proposé par défaut. Les repères ci-dessous décrivent ta participation ; ils ne mesurent ni ta santé ni une capacité physiologique.</p>
      {summary.error ? <p role="alert" className="mt-5 text-sm text-amber-200">Historique indisponible. Tes acquis ne sont pas remis à zéro.</p> : <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-white/50">Repère de participation</p><p className="mt-1 text-2xl" style={{ color: level.color }}>{level.glyph} {level.name}</p><p className="mt-1 text-sm text-white/60">{level.description_fr}</p></div>
        <div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-white/50">Séances retrouvées dans ton historique</p><p className="mt-1 text-2xl">{summary.data?.total_sessions ?? 0}</p><p className="mt-1 text-sm text-white/60">Les pauses entre les jours ne retirent aucun palier acquis.</p></div>
        <div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-white/50">Temps calculé depuis les durées enregistrées</p><p className="mt-1 text-2xl">{summary.data?.total_minutes ?? 0} min</p><p className="mt-1 text-sm text-white/60">Les séances interrompues peuvent aussi être enregistrées.</p></div>
      </div>}
    </header>
    <div className="mx-auto mt-8 max-w-5xl px-6"><WellbeingCheckin /></div>
    <section className="mx-auto mt-10 max-w-5xl px-6" aria-label="Catalogue AURORA">
      <h2 className="text-xl font-medium">Explorer les quatre variantes</h2>
      <p className="mt-2 text-sm text-white/60">Choix manuel. Les pauses de suggestions n’empêchent pas l’accès au catalogue.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{AURORA_VARIANTS.map((variant) => {
        const seconds = AURORA_PHASES[variant.id].reduce((total, phase) => total + phase.duration_sec, 0)
        return <Link key={variant.id} href={`/dashboard/aurora/${variant.id}`} data-variant={variant.id} className="rounded-2xl border border-white/15 bg-white/[0.03] p-5 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
          <span aria-hidden className="text-3xl">{variant.glyph}</span><h3 className="mt-3 text-xl" style={{ color: variant.color }}>{variant.name}</h3>
          <p className="mt-1 text-sm text-white/70">{variant.description}</p>
          <p className="mt-4 text-xs text-white/60">{Math.floor(seconds / 60)} min {seconds % 60} s · cinq phases</p>
          <span className="mt-4 inline-block text-sm underline">Ouvrir la séance</span>
        </Link>
      })}</div>
    </section>
    <div className="mx-auto mt-10 max-w-5xl px-6"><WellbeingFeedback /></div>
    <section className="mx-auto mt-10 max-w-5xl px-6">
      <h2 className="text-sm font-medium text-white/60">Repères conservés dans le temps</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">{AURORA_LEVELS.map((item) => <div key={item.id} className="rounded-xl border border-white/10 p-3"><p style={{ color: item.color }}>{item.glyph} {item.name}</p><p className="mt-1 text-xs text-white/60">{item.min_sessions === 0 ? 'Dès le début du parcours' : `${item.min_sessions} séances enregistrées, à ton rythme`}</p></div>)}</div>
    </section>
  </main>
}

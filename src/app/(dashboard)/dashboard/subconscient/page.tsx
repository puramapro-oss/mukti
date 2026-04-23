import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Moon, Sun, ArrowRight } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { REPROG_CATEGORIES } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Reprogrammation subconscient — MUKTI',
  description:
    "Mode Nuit + Mode Journée. Affirmations conscientes, son nature, volume adaptatif. Tu décides toujours début et fin.",
}

export const dynamic = 'force-dynamic'

export default async function SubconscientHubPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/subconscient')

  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const service = createServiceClient()
  let nightCount = 0
  let dayCount = 0
  let totalAffirmationsPlayed = 0

  if (profile?.id) {
    const [nightRes, dayRes, agg] = await Promise.all([
      service
        .schema('mukti')
        .from('reprogramming_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('mode', 'night'),
      service
        .schema('mukti')
        .from('reprogramming_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('mode', 'day'),
      service
        .schema('mukti')
        .from('reprogramming_sessions')
        .select('affirmations_count')
        .eq('user_id', profile.id)
        .limit(1000),
    ])
    nightCount = nightRes.count ?? 0
    dayCount = dayRes.count ?? 0
    totalAffirmationsPlayed = (agg.data as Array<{ affirmations_count: number }> | null)?.reduce(
      (sum, r) => sum + (r.affirmations_count ?? 0),
      0
    ) ?? 0
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <section className="mx-auto max-w-5xl px-6 pt-12">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
          <Moon className="h-3.5 w-3.5" />
          <span>Module 6 · Reprogrammation subconscient</span>
        </div>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          Affirmations{' '}
          <span className="bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] bg-clip-text text-transparent">
            conscientes
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
          Jamais subliminales cachées. Toujours affichées, lues volontairement. Tu choisis la catégorie, le son,
          l&apos;heure — et quand t&apos;arrêter.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Sessions nuit" value={nightCount} />
          <StatCard label="Sessions journée" value={dayCount} />
          <StatCard
            label="Affirmations posées"
            value={totalAffirmationsPlayed}
          />
        </div>
      </section>

      {/* 2 modes */}
      <section className="mx-auto mt-12 max-w-5xl px-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          Deux modes, même principe
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/dashboard/subconscient/nuit"
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1e1b4b]/40 to-[#7C3AED]/10 p-6 transition-all hover:-translate-y-0.5 hover:border-white/20"
            data-mode="night"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#7C3AED] opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
            />
            <Moon className="h-6 w-6 text-[#A78BFA]" />
            <h3 className="mt-4 text-2xl font-light">Mode Nuit</h3>
            <p className="mt-1 text-sm text-white/70">
              Affirmations douces, son nature, ramp volume 30 min, voix apaisante optionnelle. Tu démarres,
              tu poses, tu t&apos;endors.
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-xs uppercase tracking-widest text-white/60 transition-colors group-hover:text-white">
              <span>Démarrer</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 opacity-80">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#F59E0B] opacity-10 blur-3xl"
            />
            <Sun className="h-6 w-6 text-[#F59E0B]" />
            <h3 className="mt-4 text-2xl font-light">Mode Journée</h3>
            <p className="mt-1 text-sm text-white/70">
              Rappels intelligents toutes les 2h (9h-19h), création d&apos;affirmations perso, suggestions IA
              adaptées à ton programme.
            </p>
            <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
              Arrive au prochain sprint
            </span>
          </div>
        </div>
      </section>

      {/* 9 catégories */}
      <section className="mx-auto mt-14 max-w-5xl px-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          9 catégories · 914 affirmations
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {REPROG_CATEGORIES.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border p-3"
              style={{
                borderColor: `${c.color}44`,
                background: `linear-gradient(135deg, ${c.color}10, transparent)`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{c.emoji}</span>
                <span className="text-sm font-medium" style={{ color: c.color }}>
                  {c.name}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-white/40">{c.solfeggio_hz} Hz</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="text-xs uppercase tracking-widest text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-light">{value}</div>
    </div>
  )
}

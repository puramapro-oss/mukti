import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Wind, Clock, Sparkles } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { AURORA_VARIANTS, AURORA_LEVELS } from '@/lib/constants'
import { getVariantTotalSec } from '@/lib/aurora'

export const metadata: Metadata = {
  title: 'AURORA OMEGA — MUKTI',
  description:
    'Respiration neuro-régénérative en 5 phases. 4 variantes (Calm, Focus, Sleep, Ignite). Fractale vivante, Event Horizon, particules synchronisées au souffle.',
}

export const dynamic = 'force-dynamic'

export default async function AuroraHubPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/aurora')

  // Résoudre profile.id (pattern G4 ar.ts)
  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  type StreakRow = {
    current_days: number
    best_days: number
    current_level: string
    total_minutes: number
    total_sessions: number
  }

  const service = createServiceClient()
  let streak: StreakRow | null = null
  let recentCount = 0

  if (profile?.id) {
    const { data: streakRow } = await service
      .schema('mukti')
      .from('aurora_streaks')
      .select('current_days, best_days, current_level, total_minutes, total_sessions')
      .eq('user_id', profile.id)
      .maybeSingle()
    streak = (streakRow as StreakRow | null) ?? null

    const { count } = await service
      .schema('mukti')
      .from('aurora_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
    recentCount = count ?? 0
  }

  const currentLevel = streak?.current_level ?? 'brume'
  const levelMeta = AURORA_LEVELS.find((l) => l.id === currentLevel)

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-6 pt-12">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
          <Wind className="h-3.5 w-3.5" />
          <span>Module 5 · Respiration neuro</span>
        </div>
        <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">
          AURORA <span className="bg-gradient-to-r from-[#7C3AED] via-[#06B6D4] to-[#F472B6] bg-clip-text text-transparent">OMEGA</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
          5 phases. Armement, Double Sigh Reset, Résonance Core, Omega Lock, Glide Out. La fractale respire avec toi, l&apos;Event Horizon absorbe ce qui n&apos;a plus lieu d&apos;être.
        </p>

        {/* Niveau + streak */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
            style={{ borderColor: levelMeta ? `${levelMeta.color}33` : undefined }}
          >
            <div className="text-xs uppercase tracking-widest text-white/50">Niveau cohérence</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl">{levelMeta?.glyph}</span>
              <span className="text-2xl font-light" style={{ color: levelMeta?.color }}>
                {levelMeta?.name ?? 'Brume'}
              </span>
            </div>
            <div className="mt-1 text-sm text-white/60">
              {levelMeta?.description_fr ?? 'Tu poses tes premiers souffles.'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="text-xs uppercase tracking-widest text-white/50">Streak actuel</div>
            <div className="mt-2 text-2xl font-light">{streak?.current_days ?? 0} <span className="text-sm text-white/50">j</span></div>
            <div className="mt-1 text-sm text-white/60">
              Record : {streak?.best_days ?? 0} jours · {streak?.total_sessions ?? 0} sessions
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="text-xs uppercase tracking-widest text-white/50">Temps total</div>
            <div className="mt-2 text-2xl font-light">{streak?.total_minutes ?? 0} <span className="text-sm text-white/50">min</span></div>
            <div className="mt-1 text-sm text-white/60">{recentCount} session{recentCount > 1 ? 's' : ''} au total</div>
          </div>
        </div>
      </section>

      {/* 4 variantes */}
      <section className="mx-auto mt-12 max-w-5xl px-6">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-light tracking-tight">Choisis ta variante</h2>
          <span className="text-xs text-white/50">Les 5 phases sont identiques — seules les durées varient.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AURORA_VARIANTS.map((v) => {
            const total = getVariantTotalSec(v.id)
            const min = Math.round(total / 60)
            const sec = total % 60
            return (
              <Link
                key={v.id}
                href={`/dashboard/aurora/${v.id}`}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                data-variant={v.id}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60"
                  style={{ background: v.color }}
                />
                <div className="relative">
                  <div className="text-3xl">{v.glyph}</div>
                  <div className="mt-3 text-xl font-light" style={{ color: v.color }}>
                    {v.name}
                  </div>
                  <p className="mt-1 text-sm text-white/70">{v.description}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {min} min{sec > 0 ? ` ${sec}s` : ''}
                    </span>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-1 text-xs uppercase tracking-widest text-white/60 transition-colors group-hover:text-white">
                  <Sparkles className="h-3 w-3" />
                  <span>Démarrer</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Paliers niveaux */}
      <section className="mx-auto mt-14 max-w-5xl px-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-white/50">
          Paliers de cohérence
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {AURORA_LEVELS.map((l) => {
            const reached = l.id === currentLevel
            return (
              <div
                key={l.id}
                className={`rounded-xl border p-3 transition-opacity ${reached ? 'opacity-100' : 'opacity-55'}`}
                style={{
                  borderColor: `${l.color}55`,
                  background: `linear-gradient(135deg, ${l.color}10, transparent)`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{l.glyph}</span>
                  <span className="text-sm font-medium" style={{ color: l.color }}>
                    {l.name}
                  </span>
                  {reached && (
                    <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      Ici
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-white/50">
                  {l.min_days === 0 ? 'Dès ta première session' : `${l.min_days}j consécutifs · ${l.min_sessions} sessions`}
                </p>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}

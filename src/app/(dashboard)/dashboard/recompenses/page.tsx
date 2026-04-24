import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Gift } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import MysteryChest from '@/components/mode18/MysteryChest'

export const metadata: Metadata = {
  title: 'Récompenses Mystères — MUKTI',
  description: 'Ton coffre quotidien. Points, coupons, boosters, surprises.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function RecompensesPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/recompenses')

  const srv = createServiceClient()
  const { data: profile } = await srv
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const profileId = (profile as { id: string } | null)?.id ?? ''

  const today = todayUtc()
  const [todayRes, historyRes] = await Promise.all([
    srv
      .schema('mukti')
      .from('mystery_rewards')
      .select('*')
      .eq('user_id', profileId)
      .eq('claim_date', today)
      .maybeSingle(),
    srv
      .schema('mukti')
      .from('mystery_rewards')
      .select('*')
      .eq('user_id', profileId)
      .order('claim_date', { ascending: false })
      .limit(14),
  ])
  const initialToday = todayRes.data ? (todayRes.data as Parameters<typeof MysteryChest>[0]['initialToday']) : null
  const initialHistory = (historyRes.data ?? []) as Parameters<typeof MysteryChest>[0]['initialHistory']

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/dashboard/modes-avances"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Modes
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-2xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/55">
          <Gift className="h-3.5 w-3.5 text-[#F59E0B]" />
          Mode 18
        </div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
          Récompenses{' '}
          <span className="bg-gradient-to-r from-[#F59E0B] to-[#ec4899] bg-clip-text text-transparent">
            mystères
          </span>
        </h1>
        <p className="mt-3 text-sm text-white/70">
          Un coffre par jour. 4 niveaux (commun / rare / légendaire / JACKPOT). Streak consécutif
          = multiplicateur jusqu&apos;à ×3.
        </p>

        <div className="mt-8">
          <MysteryChest initialToday={initialToday} initialHistory={initialHistory} />
        </div>
      </section>
    </main>
  )
}

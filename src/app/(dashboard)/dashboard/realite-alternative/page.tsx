import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Eye } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import AltRealityProjection from '@/components/mode17/AltRealityProjection'

export const metadata: Metadata = {
  title: 'Réalité Alternative — MUKTI',
  description: 'Ta version libérée dans 7, 30, 90 ou 365 jours.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function RealiteAlternativePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/realite-alternative')

  const srv = createServiceClient()
  const { data: profile } = await srv
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const profileId = (profile as { id: string } | null)?.id ?? ''

  const [addictionsRes, sessionsRes] = await Promise.all([
    srv
      .schema('mukti')
      .from('addictions')
      .select('id, type, status')
      .eq('user_id', profileId)
      .in('status', ['active', 'stopped'])
      .limit(10),
    srv
      .schema('mukti')
      .from('alt_reality_sessions')
      .select(
        'id, projection_horizon_days, projection_url, projection_prompt, created_at'
      )
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  const addictions = (addictionsRes.data ?? []) as {
    id: string
    type: string
    status: string
  }[]
  const sessions = (sessionsRes.data ?? []) as {
    id: string
    projection_horizon_days: number
    projection_url: string | null
    projection_prompt: string | null
    created_at: string
  }[]

  return (
    <main className="min-h-screen bg-[#0A0A0F] pb-20 text-white">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/dashboard/modes-avances"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Modes
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-4xl px-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/55">
          <Eye className="h-3.5 w-3.5 text-[#a855f7]" />
          Mode 17
        </div>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
          Réalité{' '}
          <span className="bg-gradient-to-r from-[#a855f7] to-[#06b6d4] bg-clip-text text-transparent">
            alternative
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          Regarde-toi dans 30 jours, libéré·e. IA + Flux génèrent une projection visuelle
          personnalisée de ton toi sans addiction.
        </p>

        <div className="mt-8">
          <AltRealityProjection
            addictions={addictions.map(a => ({ id: a.id, type: a.type }))}
            initialSessions={sessions}
          />
        </div>
      </section>
    </main>
  )
}

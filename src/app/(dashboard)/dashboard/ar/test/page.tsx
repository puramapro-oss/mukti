import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ARTestClient from '@/components/ar/ARTestClient'

export const metadata: Metadata = {
  title: 'AR · Smoke test tracker — MUKTI',
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

export default async function ArTestPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/ar/test')

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">
          Smoke test · dev
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Tracker AR — pose + mains</h1>
        <p className="mt-1 text-sm text-white/55">
          Autorise la caméra pour vérifier la détection. Aucune donnée n&apos;est enregistrée.
        </p>
      </header>
      <ARTestClient />
    </div>
  )
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ExorcismeFlowClient from '@/components/exorcisme/ExorcismeFlowClient'

export const metadata: Metadata = {
  title: 'Séance Exorcisme — MUKTI',
  description:
    'Séance immersive en 5 phases — active uniquement si tu es au calme pour 3 minutes.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ExorcismeSeancePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/exorcisme/seance')

  return <ExorcismeFlowClient />
}

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getActiveSubscription } from '@/lib/subscriptions'
import AbonnementClient from '@/components/billing/AbonnementClient'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Abonnement — MUKTI',
  robots: { index: false, follow: false },
}

export default async function AbonnementPage() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/settings/abonnement')
  const sub = await getActiveSubscription()
  return <AbonnementClient initialSubscription={sub} />
}

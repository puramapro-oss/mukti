import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { AFFIRMATION_WIDGET_PATH } from '@/lib/affirmation-widget'
import AffirmationWidgetEditor from '@/components/reprogrammation/AffirmationWidgetEditor'

export const metadata: Metadata = {
  title: 'Mes affirmations sur mon écran — MUKTI',
  description: 'Choisis les affirmations de ton widget MUKTI, pour chaque jour ou trois moments de la journée.',
}
export const dynamic = 'force-dynamic'

export default async function AffirmationWidgetPage() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(AFFIRMATION_WIDGET_PATH)}`)
  return <AffirmationWidgetEditor />
}

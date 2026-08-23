import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import MaMemoirePage from '@/lib/legal/components/MaMemoirePage'

export const metadata: Metadata = {
  title: 'Ma mémoire — MUKTI',
  description: 'Consulte, exporte ou efface tes données MUKTI.',
}

export const dynamic = 'force-dynamic'

export default async function MaMemoire() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/ma-memoire')

  const [{ data: acceptations }, { data: deletionRequest }] = await Promise.all([
    sb.from('legal_acceptances').select('doc_type, version, accepted_at').eq('user_id', user.id),
    sb
      .from('account_deletion_requests')
      .select('scheduled_for')
      .eq('user_id', user.id)
      .eq('status', 'scheduled')
      .maybeSingle(),
  ])

  return (
    <MaMemoirePage
      appName="MUKTI"
      acceptations={(acceptations ?? []).map((a) => ({
        docType: a.doc_type,
        version: a.version,
        acceptedAt: a.accepted_at,
      }))}
      deletionScheduledFor={deletionRequest?.scheduled_for ?? null}
    />
  )
}

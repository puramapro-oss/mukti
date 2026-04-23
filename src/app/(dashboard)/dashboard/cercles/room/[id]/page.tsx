import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CircleRoom from '@/components/cercles/room/CircleRoom'

export const metadata: Metadata = {
  title: 'Cercle d\'Intention — MUKTI',
  description: 'Session audio live d\'un cercle d\'intention.',
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CircleRoomPage({ params }: Props) {
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/cercles/room/${id}`)

  const { data: profile } = await sb
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <CircleRoom
      circleId={id}
      myUserId={user.id}
      myName={(profile as { full_name?: string } | null)?.full_name ?? null}
    />
  )
}

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MODES_G2, type ModeId, type AddictionId } from '@/lib/constants'
import { getActiveStreak } from '@/lib/streaks'
import { getAffirmation } from '@/lib/awakening'
import Mode1CoupureInstantanee from '@/components/modes/Mode1CoupureInstantanee'
import Mode2MultisensorielUltime from '@/components/modes/Mode2MultisensorielUltime'
import Mode3MicroMeditation from '@/components/modes/Mode3MicroMeditation'
import Mode4AvatarAnticraving from '@/components/modes/Mode4AvatarAnticraving'
import Mode5CompteurMotivation from '@/components/modes/Mode5CompteurMotivation'

export const metadata: Metadata = {
  title: 'Mode — MUKTI',
}

export const dynamic = 'force-dynamic'

const VALID_MODES = MODES_G2.map(m => m.id) as ModeId[]

export default async function ModePage({
  params,
}: {
  params: Promise<{ addictionId: string; modeId: string }>
}) {
  const { addictionId, modeId } = await params
  if (!VALID_MODES.includes(modeId as ModeId)) notFound()

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/liberation/${addictionId}/mode/${modeId}`)

  const { data: addiction } = await sb
    .from('addictions')
    .select('id, type, status')
    .eq('id', addictionId)
    .maybeSingle()

  if (!addiction) notFound()

  switch (modeId as ModeId) {
    case 'coupure_40s':
      return <Mode1CoupureInstantanee addictionId={addictionId} />
    case 'multisensoriel':
      return <Mode2MultisensorielUltime addictionId={addictionId} />
    case 'micro_meditation': {
      const aff = await getAffirmation('liberation-addictions').catch(() => null)
      return <Mode3MicroMeditation addictionId={addictionId} affirmation={aff?.text ?? null} />
    }
    case 'avatar': {
      const streak = await getActiveStreak(addictionId)
      return <Mode4AvatarAnticraving addictionId={addictionId} currentDays={streak?.current_days ?? 0} />
    }
    case 'compteur': {
      const streak = await getActiveStreak(addictionId)
      return (
        <Mode5CompteurMotivation
          addictionId={addictionId}
          type={addiction.type as AddictionId}
          currentDays={streak?.current_days ?? 0}
          bestDays={streak?.best_days ?? 0}
        />
      )
    }
    default:
      notFound()
  }
}

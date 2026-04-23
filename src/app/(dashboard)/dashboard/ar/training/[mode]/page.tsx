import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { getTrainingProgress } from '@/lib/ar-training'
import ArTrainingRoom from '@/components/ar/ArTrainingRoom'
import { AR_TRAINING_MODES, type ArTrainingMode } from '@/lib/constants'

interface Props {
  params: Promise<{ mode: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mode } = await params
  if (mode === 'soin') {
    return {
      title: 'Formation Soin — MUKTI',
      description: '5 gestes pour apprendre à te poser les mains fantômes. 100% local, rien n\'est enregistré.',
    }
  }
  if (mode === 'manifestation') {
    return {
      title: 'Formation Manifestation — MUKTI',
      description: '5 gestes pour apprendre à émettre ton rayon d\'intention vers une cible.',
    }
  }
  return { title: 'Formation — MUKTI' }
}

export default async function ArTrainingPage({ params }: Props) {
  const { mode } = await params
  if (!AR_TRAINING_MODES.includes(mode as ArTrainingMode)) {
    notFound()
  }
  const trainingMode = mode as ArTrainingMode

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/ar/training/${mode}`)

  const profileId = await resolveProfileId(sb)
  const progress = profileId
    ? await getTrainingProgress(profileId)
    : { soin: [], manifestation: [], soin_completed: false, manifestation_completed: false }

  const savedSteps = trainingMode === 'soin' ? progress.soin : progress.manifestation
  const initialStep = (() => {
    if (savedSteps.length === 0) return 1
    const lastDone = Math.max(...savedSteps)
    return lastDone >= 5 ? 1 : Math.min(5, lastDone + 1)
  })() as 1 | 2 | 3 | 4 | 5

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/dashboard/ar"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour au miroir
      </Link>
      <header>
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: trainingMode === 'soin' ? '#06B6D4' : '#D946EF' }}
        >
          Formation · {trainingMode === 'soin' ? 'Soin' : 'Manifestation'}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          {trainingMode === 'soin' ? 'Apprendre à se poser les mains' : 'Apprendre à émettre un rayon'}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-white/55">
          {trainingMode === 'soin'
            ? '5 gestes courts pour t\'approprier le miroir — rien à mémoriser, juste à ressentir.'
            : '5 gestes courts pour diriger ton intention — d\'abord vers toi, puis vers le monde.'}
        </p>
      </header>
      <ArTrainingRoom mode={trainingMode} initialStep={initialStep} savedSteps={savedSteps} />
    </div>
  )
}

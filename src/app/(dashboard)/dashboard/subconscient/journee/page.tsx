import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import DayPlayer from '@/components/reprogrammation/DayPlayer'

export const metadata: Metadata = {
  title: 'Mode Journée — MUKTI',
  description:
    'Affirmations éveillantes au rythme de la journée. Tu poses, tu reviens à toi, tu reprends ton chemin.',
}

export const dynamic = 'force-dynamic'

export default async function SubconscientJourneePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/subconscient/journee')

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] text-white">
      <header className="absolute left-0 right-0 top-0 z-30 px-5 pt-5 sm:px-8 sm:pt-7">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/dashboard/subconscient"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Reprogrammation
          </Link>
        </div>
      </header>

      <DayPlayer initialCategory="confiance" initialNatureSound="silence" />
    </div>
  )
}

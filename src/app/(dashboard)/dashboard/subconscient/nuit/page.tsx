import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import NightPlayer from '@/components/reprogrammation/NightPlayer'

export const metadata: Metadata = {
  title: 'Mode Nuit — MUKTI',
  description:
    'Affirmations lentes, son nature synthétisé, volume qui descend sur 30 min. Tu poses, tu respires, tu t\'endors.',
}

export const dynamic = 'force-dynamic'

export default async function SubconscientNuitPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/subconscient/nuit')

  return (
    <div className="relative min-h-screen bg-[#05050a] text-white">
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

      <NightPlayer initialCategory="sommeil-reparateur" initialNatureSound="ocean" />
    </div>
  )
}

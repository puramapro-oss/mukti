import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sparkles } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { QaChat } from '@/components/qa/QaChat'
import { inferCountryFromHeaders } from '@/lib/emergency-resources'

export const metadata: Metadata = {
  title: 'Aide IA — MUKTI',
  description: 'Compagnon IA qui répond à tes questions sur MUKTI, sur ton chemin, ou qui écoute simplement.',
}

export const dynamic = 'force-dynamic'

export default async function AideIaPage({
  searchParams,
}: {
  searchParams: Promise<{ signal?: string }>
}) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/aide-ia')
  const profileId = await resolveProfileId(sb)

  const params = await searchParams
  const initialSignalDistress = params.signal === 'distress'

  // Resolve country + lang
  const h = await headers()
  let country = 'FR'
  let lang: 'fr' | 'en' = 'fr'
  if (profileId) {
    const { data } = await sb
      .from('profiles')
      .select('country_code, preferred_lang')
      .eq('id', profileId)
      .maybeSingle()
    const row = data as { country_code: string | null; preferred_lang: string | null } | null
    if (row?.country_code) country = row.country_code
    if (row?.preferred_lang === 'en') lang = 'en'
  }
  if (country === 'FR' && !profileId) {
    country = inferCountryFromHeaders(h.get('accept-language'), h.get('x-vercel-ip-timezone'))
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Aide IA — libre & présente
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-white">
          {lang === 'en' ? 'Ask MUKTI' : 'Pose ta question à MUKTI'}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
          <Sparkles className="mr-1 inline h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
          {lang === 'en'
            ? 'I am not a therapist. If you are in distress, I will orient you to resources in your country.'
            : "Je ne suis pas thérapeute. Si tu traverses une détresse, je t'oriente vers des ressources dans ton pays."}
        </p>
      </header>

      <QaChat
        initialSignalDistress={initialSignalDistress}
        countryCode={country}
        lang={lang}
      />
    </div>
  )
}

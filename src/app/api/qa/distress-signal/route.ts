// MUKTI G8.5 — Signal détresse → ressources pays
import { NextResponse } from 'next/server'
import { getResourcesByCountry, inferCountryFromHeaders } from '@/lib/emergency-resources'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { buildSortieDouceProtocolFr, buildSortieDouceProtocolEn } from '@/lib/qa-engine'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`qa-distress:${profileId}`, 20, 60)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  // Resolve country : profile > headers
  let country: string | null = null
  try {
    const { data } = await sb.from('profiles').select('country_code, preferred_lang').eq('id', profileId).maybeSingle()
    const row = data as { country_code: string | null; preferred_lang: string | null } | null
    country = row?.country_code ?? null
  } catch {
    country = null
  }
  if (!country) {
    country = inferCountryFromHeaders(
      req.headers.get('accept-language'),
      req.headers.get('x-vercel-ip-timezone') ?? null,
    )
  }
  const resources = await getResourcesByCountry(country)
  // Log incident (self RLS so use service)
  try {
    const admin = createServiceClient()
    await admin.from('qa_conversations').insert({
      user_id: profileId,
      question: '[DISTRESS_SIGNAL button]',
      answer: '[RESOURCES_SERVED]',
      distress_score: 1,
      escalated: true,
      country_code: country,
      lang: 'fr',
    })
  } catch {
    // silent
  }
  const lang = req.headers.get('accept-language')?.toLowerCase().startsWith('en') ? 'en' : 'fr'
  return NextResponse.json({
    country_code: country,
    lang,
    resources,
    protocol: lang === 'en' ? buildSortieDouceProtocolEn() : buildSortieDouceProtocolFr(),
  })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { REPROG_CATEGORIES } from '@/lib/constants/reprogrammation'
import { rateLimit } from '@/lib/rate-limit'
import { catalogueWidgetItems } from '@/lib/affirmation-widget'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const querySchema = z.object({
  category: z.enum(REPROG_CATEGORIES.map(item => item.id)),
  locale: z.enum(['fr', 'en']).default('fr'),
})
const privateHeaders = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  try {
    const sb = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) {
      const status = authError?.status && authError.status >= 500 ? 503 : 401
      return NextResponse.json({ ok: false, error: status === 401
        ? 'Connecte-toi pour choisir tes affirmations.' : 'Connexion momentanément indisponible. Réessaie.' },
      { status, headers: privateHeaders })
    }
    const limit = rateLimit(`affirmation-widget:${user.id}`, 120, 3600)
    if (!limit.ok) return NextResponse.json({ ok: false, error: 'Patiente un instant avant de recharger le catalogue.' },
      { status: 429, headers: { ...privateHeaders, 'Retry-After': String(limit.retryAfterSec) } })
    const url = new URL(request.url)
    const parsed = querySchema.safeParse({ category: url.searchParams.get('category') ?? 'paix', locale: url.searchParams.get('locale') ?? 'fr' })
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Catégorie ou langue inconnue.' },
      { status: 400, headers: privateHeaders })
    // Read the existing catalogue with the authenticated/RLS client. Never use
    // affirmation_custom, a service-role client or an AI call for this surface.
    const { data, error } = await sb.schema('mukti').from('affirmations')
      .select('id, source, text_fr, text_en').eq('active', true).eq('source', 'purama')
      .eq('category', parsed.data.category).order('id', { ascending: true }).limit(500)
    if (error) return NextResponse.json({ ok: false, error: 'Le catalogue est indisponible. Ta sélection enregistrée reste sur ton téléphone.' },
      { status: 503, headers: privateHeaders })
    return NextResponse.json({ ok: true, items: catalogueWidgetItems(data, parsed.data.locale) }, { headers: privateHeaders })
  } catch {
    return NextResponse.json({ ok: false, error: 'Impossible de charger le catalogue. Réessaie dans un instant.' },
      { status: 503, headers: privateHeaders })
  }
}

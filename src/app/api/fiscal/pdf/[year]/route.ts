// MUKTI — G7 Génère PDF fiscal à la volée pour un year donné
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { resolveProfileId } from '@/lib/ar'
import { generateAnnualPDF, storeAnnualDeclaration } from '@/lib/fiscal'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

interface Params { params: Promise<{ year: string }> }

export async function GET(req: Request, { params }: Params) {
  void req
  const { year: rawYear } = await params
  const year = parseInt(rawYear, 10)
  if (!Number.isFinite(year) || year < 2025 || year > 2100) {
    return NextResponse.json({ error: 'Année invalide.' }, { status: 400 })
  }
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`fiscal-pdf:${profileId}`, 5, 3600)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de générations — réessaie plus tard.' }, { status: 429 })
  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', profileId)
    .maybeSingle()
  const p = profile as { full_name: string | null; email: string | null } | null
  if (!p) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  const { buffer, totalCents, profileType } = await generateAnnualPDF({
    userId: profileId,
    year,
    fullName: p.full_name ?? 'Utilisateur MUKTI',
    email: p.email ?? '',
  })
  await storeAnnualDeclaration({
    userId: profileId,
    year,
    totalCents,
    profileType,
    pdfUrl: '',
  })
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="MUKTI-fiscal-${year}.pdf"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}

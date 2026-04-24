// MUKTI — G7 CRON génère PDFs annuels N-1 pour tous users earning > 0
// Schedule : 1er janvier 02h
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateAnnualPDF, storeAnnualDeclaration, computeYearEarningsCents } from '@/lib/fiscal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  return !!req.headers.get('x-vercel-cron')
}

export async function POST(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  const admin = createServiceClient()
  const year = new Date().getUTCFullYear() - 1
  // Find all users with earnings > 0 for that year
  const { data: commissions } = await admin
    .from('commissions')
    .select('user_id')
    .in('status', ['credited', 'paid'])
    .gte('created_at', `${year}-01-01T00:00:00Z`)
    .lt('created_at', `${year + 1}-01-01T00:00:00Z`)
  const ids = Array.from(new Set(((commissions ?? []) as Array<{ user_id: string }>).map(u => u.user_id)))
  let generated = 0
  for (const userId of ids) {
    try {
      const earnings = await computeYearEarningsCents(userId, year)
      if (earnings <= 0) continue
      const { data: profile } = await admin
        .from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
      const p = profile as { full_name: string | null; email: string | null } | null
      if (!p?.email) continue
      const { buffer, totalCents, profileType } = await generateAnnualPDF({
        userId, year, fullName: p.full_name ?? 'Utilisateur MUKTI', email: p.email,
      })
      const path = `fiscal-declarations/${userId}/${year}.pdf`
      await admin.storage.from('public').upload(path, Buffer.from(buffer), {
        contentType: 'application/pdf', upsert: true,
      }).catch(() => null)
      const { data: { publicUrl } } = admin.storage.from('public').getPublicUrl(path)
      await storeAnnualDeclaration({
        userId, year, totalCents, profileType, pdfUrl: publicUrl,
      })
      generated += 1
    } catch { /* skip */ }
  }
  return NextResponse.json({ ok: true, year, generated })
}

export async function GET(req: Request) { return POST(req) }

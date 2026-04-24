// MUKTI — G7 CRON reclasse tous les users selon gains 12 derniers mois
// Schedule : 1er de chaque mois à 03h
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { upsertFiscalProfile } from '@/lib/fiscal'

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
  // Users avec au moins 1 commission ou prize
  const { data: users } = await admin
    .from('commissions')
    .select('user_id')
    .in('status', ['credited', 'paid'])
  const ids = Array.from(new Set(((users ?? []) as Array<{ user_id: string }>).map(u => u.user_id)))
  let count = 0
  for (const userId of ids) {
    try {
      await upsertFiscalProfile(userId)
      count += 1
    } catch { /* skip */ }
  }
  return NextResponse.json({ ok: true, processed: count })
}

export async function GET(req: Request) { return POST(req) }

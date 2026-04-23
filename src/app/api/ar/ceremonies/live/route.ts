// GET /api/ar/ceremonies/live — retourne la prochaine cérémonie live ou upcoming
// (utilisé par la page hub AR et par le widget "prochain Moment Z").

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getParticipantsCount } from '@/lib/ar-ceremony'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  const sb = createServiceClient()
  const { data } = await sb
    .from('ar_ceremonies')
    .select('*')
    .in('status', ['upcoming', 'live'])
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ ok: true, ceremony: null })
  }
  const c = data as { id: string }
  const count = await getParticipantsCount(c.id)
  return NextResponse.json(
    { ok: true, ceremony: { ...data, participants_count: count } },
    { headers: { 'Cache-Control': 'public, max-age=15' } },
  )
}

// GET /api/mental-journal/entries — historique journal mental.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { listEntries } from '@/lib/mental-journal'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`journal:entries:${user.id}:${ip}`, 60, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? '7')
  const entries = await listEntries(Number.isFinite(limit) ? limit : 7)
  return NextResponse.json({ entries })
}

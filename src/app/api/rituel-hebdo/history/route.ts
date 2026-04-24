// MUKTI G8.4 — History rituel hebdo (self-only)
import { NextResponse } from 'next/server'
import { getMyRituelHistory } from '@/lib/rituel-hebdo'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`rituel-history:${profileId}`, 30, 60)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  const url = new URL(req.url)
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw ? Math.min(50, Math.max(1, parseInt(limitRaw, 10) || 10)) : 10
  const history = await getMyRituelHistory(limit)
  return NextResponse.json({ history })
}

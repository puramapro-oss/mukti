// MUKTI G8.3 — Timeline Fil de Vie (pagination curseur)
import { NextResponse } from 'next/server'
import { getMyTimeline } from '@/lib/life-feed'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  const rl = rateLimit(`life-timeline:${profileId}`, 30, 60)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 50)) : 50
  const result = await getMyTimeline(limit, cursor)
  return NextResponse.json(result)
}

// GET /api/boucle-urgence/stats — renvoie stats + 10 récents pour l'utilisateur courant.
// Rate 120/h.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { computeBoucleUrgenceStats } from '@/lib/boucle-urgence'

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
  const rl = rateLimit(`boucle-urgence:stats:${user.id}:${ip}`, 120, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Respire — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const profileId = (profile as { id: string } | null)?.id
  if (!profileId) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  }

  const stats = await computeBoucleUrgenceStats(profileId)
  return NextResponse.json({ stats }, { status: 200 })
}

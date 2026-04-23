// GET /api/rituel-7s/streak — renvoie streak (current/best/today/total) + 10 récents

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { computeRituel7sStreak } from '@/lib/rituel-7s'

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
  const rl = rateLimit(`rituel7s:streak:${user.id}:${ip}`, 120, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Reviens dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const { data: profile } = await sb
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const profileRow = profile as { id: string } | null
  if (!profileRow?.id) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  }

  const streak = await computeRituel7sStreak(profileRow.id)
  return NextResponse.json({ streak }, { status: 200 })
}

// GET /api/minimal-ritual/today — authoritative participation and retained progress.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { loadMinimalRitualToday, MinimalRitualError } from '@/lib/minimal-ritual'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(req: Request) {
  try {
    const sb = await createServerSupabaseClient()
    const {
      data: { user },
    } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
    }

    const ip = getClientIp(req)
    const rl = rateLimit(`minimal:today:${user.id}:${ip}`, 120, 3600)
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Réessaie dans ${rl.retryAfterSec}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    const snapshot = await loadMinimalRitualToday()
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof MinimalRitualError ? error.message : 'Impossible de lire tes choix enregistrés. Réessaie dans un instant.' },
      { status: error instanceof MinimalRitualError ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}

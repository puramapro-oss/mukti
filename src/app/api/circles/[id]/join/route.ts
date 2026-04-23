// POST /api/circles/[id]/join — rejoindre un cercle

import { NextResponse } from 'next/server'
import { joinCircle } from '@/lib/circles'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id || typeof id !== 'string' || id.length < 8) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise pour rejoindre un cercle.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`circles:join:${ip}`, 30, 600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  try {
    const participant = await joinCircle(id)
    return NextResponse.json({ ok: true, participant })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('MUKTI_CIRCLE_FULL')) {
      return NextResponse.json({ error: 'Ce cercle est complet. Crée le tien ou essaie-en un autre.' }, { status: 409 })
    }
    if (msg.includes('MUKTI_CIRCLE_CLOSED')) {
      return NextResponse.json({ error: 'Ce cercle est clôturé.' }, { status: 410 })
    }
    if (msg.includes('MUKTI_CIRCLE_NOT_FOUND')) {
      return NextResponse.json({ error: 'Ce cercle n\'existe plus.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Impossible de rejoindre ce cercle. Réessaie.' }, { status: 400 })
  }
}

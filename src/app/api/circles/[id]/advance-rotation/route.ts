// POST /api/circles/[id]/advance-rotation — creator/moderator : tour suivant
// Pour mode 'fixed' = avance manuelle uniquement.
// Pour mode 'auto' = client peut appeler quand timer local expire (le serveur valide rôle).
// Pour mode 'random' = server picks random parmi non-focused.

import { NextResponse } from 'next/server'
import { advanceRotation } from '@/lib/circles'
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
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`circles:rotate:${ip}`, 60, 600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  try {
    const rotation = await advanceRotation(id)
    return NextResponse.json({ ok: true, rotation })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('MUKTI_NOT_AUTHORIZED')) {
      return NextResponse.json({ error: 'Seul le créateur ou un modérateur peut avancer la rotation.' }, { status: 403 })
    }
    if (msg.includes('MUKTI_CIRCLE_NOT_LIVE')) {
      return NextResponse.json({ error: 'Le cercle doit être en session (live).' }, { status: 409 })
    }
    if (msg.includes('MUKTI_NO_PARTICIPANTS')) {
      return NextResponse.json({ error: 'Aucun participant actif.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Impossible d\'avancer la rotation. Réessaie.' }, { status: 400 })
  }
}

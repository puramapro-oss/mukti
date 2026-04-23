// POST /api/circles/[id]/leave — quitter un cercle

import { NextResponse } from 'next/server'
import { leaveCircle } from '@/lib/circles'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  try {
    await leaveCircle(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur départ.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

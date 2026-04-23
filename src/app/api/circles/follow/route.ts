// POST   /api/circles/follow — { followed_id }
// DELETE /api/circles/follow?followed_id=...

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const Schema = z.object({ followed_id: z.string().uuid() })

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`circles:follow:${ip}`, 30, 600)
  if (!rl.ok) {
    return NextResponse.json({ error: `Réessaie dans ${rl.retryAfterSec}s.` }, { status: 429 })
  }

  const json = await req.json().catch(() => null)
  const parsed = Schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  if (parsed.data.followed_id === user.id) {
    return NextResponse.json({ error: 'Tu ne peux pas te suivre toi-même.' }, { status: 400 })
  }

  const { error } = await sb.from('circle_follows').insert({
    follower_id: user.id,
    followed_id: parsed.data.followed_id,
  })

  if (error && !error.message.includes('duplicate key')) {
    return NextResponse.json({ error: 'Action refusée.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const target = url.searchParams.get('followed_id')
  if (!target || !/^[0-9a-f-]{36}$/i.test(target)) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  const { error } = await sb
    .from('circle_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('followed_id', target)

  if (error) {
    return NextResponse.json({ error: 'Action refusée.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

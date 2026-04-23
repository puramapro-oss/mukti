// GET /api/circles/[id]/messages — messages d'un cercle (participants seulement pour kinds session)
// POST /api/circles/[id]/messages — ajout d'un message (gratitude / feeling / kind_message / forum)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

const BodySchema = z.object({
  kind: z.enum(['feeling', 'gratitude', 'kind_message', 'forum']),
  content: z.string().trim().min(1).max(2000),
})

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
  const rl = rateLimit(`circles:msg:${ip}`, 30, 600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Tu vas trop vite — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Message invalide.' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('circle_messages')
    .insert({
      circle_id: id,
      user_id: user.id,
      kind: parsed.data.kind,
      content: parsed.data.content,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Message refusé.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, message: data }, { status: 201 })
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id || typeof id !== 'string' || id.length < 8) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  const url = new URL(req.url)
  const kindParam = url.searchParams.get('kind')
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50))

  const sb = await createServerSupabaseClient()
  let q = sb
    .from('circle_messages')
    .select('*')
    .eq('circle_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (kindParam && ['feeling', 'gratitude', 'kind_message', 'forum'].includes(kindParam)) {
    q = q.eq('kind', kindParam)
  }

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: 'Erreur chargement.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, messages: data ?? [] })
}

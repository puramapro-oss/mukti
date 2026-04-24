// GET /api/boite-noire/entries?addiction_id=UUID&limit=50 — liste entries d'une addiction.
// Rate 120/h. RLS ownership via listEntries().

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { listEntries } from '@/lib/boite-noire'

export const runtime = 'nodejs'
export const maxDuration = 10

const QuerySchema = z.object({
  addiction_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`boite-noire:entries:${user.id}:${ip}`, 120, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Respire — réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    addiction_id: url.searchParams.get('addiction_id') ?? '',
    limit: url.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'addiction_id requis.' },
      { status: 400 }
    )
  }

  const result = await listEntries({
    addictionId: parsed.data.addiction_id,
    limit: parsed.data.limit,
  })
  if (result.error) {
    const status = result.error.includes('authentifié') ? 401 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ entries: result.entries }, { status: 200 })
}

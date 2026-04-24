// POST /api/energy-replacement/session — log une session Mode 16 (rate 30/h).
// GET /api/energy-replacement/session — liste 20 dernières (rate 120/h).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { logEnergySession, listEnergySessions } from '@/lib/energy-replacement'
import { ENERGY_REPLACEMENT_CHANNELS, type EnergyChannel } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const ChannelEnum = z.enum(
  ENERGY_REPLACEMENT_CHANNELS.map(c => c.id) as [string, ...string[]]
)

const LogSchema = z.object({
  channel: ChannelEnum,
  duration_sec: z.number().int().min(0).max(1800).optional(),
  completed: z.boolean().optional(),
  urge_before: z.number().int().min(1).max(10).optional(),
  urge_after: z.number().int().min(1).max(10).optional(),
})

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour lancer une session.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`energy:session:${user.id}:${ip}`, 30, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = LogSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await logEnergySession({
    channel: parsed.data.channel as EnergyChannel,
    duration_sec: parsed.data.duration_sec,
    completed: parsed.data.completed,
    urge_before: parsed.data.urge_before,
    urge_after: parsed.data.urge_after,
  })
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ session: result.session }, { status: 201 })
}

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour voir tes sessions.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`energy:session:get:${user.id}:${ip}`, 120, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? '20')
  const sessions = await listEnergySessions(Number.isFinite(limit) ? limit : 20)
  return NextResponse.json({ sessions })
}

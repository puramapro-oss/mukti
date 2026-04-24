// GET /api/core/events — liste publique événements scheduled/live/finished (pas d'auth requise pour la lecture).
// POST /api/core/events — crée un événement community-led (auth + trust_score ≥ 60, rate 10/h).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  createEventCommunity,
  listEvents,
  type CoreEvent,
} from '@/lib/core-events'
import {
  CORE_FORMATS,
  CORE_CATEGORIES,
  CORE_PROTOCOLS_CATALOG,
  type CoreFormat,
  type CoreProtocolId,
} from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 10

const FormatEnum = z.enum(CORE_FORMATS.map(f => f.id) as [string, ...string[]])
const CategoryEnum = z.enum(CORE_CATEGORIES.map(c => c.id) as [string, ...string[]])
const ProtocolEnum = z.enum(CORE_PROTOCOLS_CATALOG.map(p => p.id) as [string, ...string[]])

const CreateSchema = z.object({
  format: FormatEnum,
  category: CategoryEnum,
  severity: z.number().int().min(1).max(5),
  title_fr: z.string().min(4).max(140),
  title_en: z.string().min(4).max(140),
  intention_fr: z.string().min(3).max(80),
  intention_en: z.string().min(3).max(80),
  region: z.string().max(120).nullable().optional(),
  moment_z_at: z.string().datetime(),
  ar_protocol_id: ProtocolEnum.nullable().optional(),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const format = url.searchParams.get('format')
  const status = url.searchParams.get('status') as CoreEvent['status'] | null
  const limit = Number(url.searchParams.get('limit') ?? '30')

  const events = await listEvents({
    format: format && (CORE_FORMATS as readonly { id: string }[]).some(f => f.id === format)
      ? (format as CoreFormat)
      : undefined,
    status:
      status && ['scheduled', 'live', 'finished'].includes(status)
        ? status
        : undefined,
    limit: Number.isFinite(limit) ? limit : 30,
  })
  return NextResponse.json({ events })
}

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Connexion requise pour créer un événement C.O.R.E.' },
      { status: 401 }
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`core:events:create:${user.id}:${ip}`, 10, 3600)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Réessaie dans ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 }
    )
  }

  const result = await createEventCommunity({
    format: parsed.data.format as CoreFormat,
    category: parsed.data.category as typeof CORE_CATEGORIES[number]['id'],
    severity: parsed.data.severity,
    title_fr: parsed.data.title_fr,
    title_en: parsed.data.title_en,
    intention_fr: parsed.data.intention_fr,
    intention_en: parsed.data.intention_en,
    region: parsed.data.region ?? null,
    moment_z_at: parsed.data.moment_z_at,
    ar_protocol_id: (parsed.data.ar_protocol_id ?? null) as CoreProtocolId | null,
  })

  if (result.error) {
    const status = result.error.includes('Trust score') ? 403 : 400
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ event: result.event }, { status: 201 })
}

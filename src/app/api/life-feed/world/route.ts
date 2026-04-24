// MUKTI G8.3 — Agrégats mondiaux (public, anonymisés par pays)
import { NextResponse } from 'next/server'
import { getWorldImpactAggregated } from '@/lib/life-feed'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`life-world:${ip}`, 30, 60)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  const aggregates = await getWorldImpactAggregated()
  return NextResponse.json(
    { aggregates, updated_at: new Date().toISOString() },
    {
      headers: {
        'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
      },
    },
  )
}

// GET /api/ar/ceremonies — liste cérémonies Moment Z (public, filter status)
//   ?status=upcoming|live|finished|all (default: all — upcoming + live + finished récentes)

import { NextResponse } from 'next/server'
import { listCeremonies } from '@/lib/ar-ceremony'

export const runtime = 'nodejs'
export const maxDuration = 10

const VALID = new Set(['upcoming', 'live', 'finished', 'all'])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const status = (url.searchParams.get('status') ?? 'all').toLowerCase()
  if (!VALID.has(status)) {
    return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
  }
  const ceremonies = await listCeremonies(status as 'upcoming' | 'live' | 'finished' | 'all')
  return NextResponse.json(
    { ok: true, ceremonies },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } },
  )
}

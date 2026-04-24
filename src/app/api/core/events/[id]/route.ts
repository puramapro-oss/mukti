// GET /api/core/events/[id] — détail événement + sessions (public).

import { NextResponse } from 'next/server'
import { getEventById, getEventSessions } from '@/lib/core-events'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const event = await getEventById(id)
  if (!event) {
    return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 })
  }
  if (!['scheduled', 'live', 'finished', 'draft'].includes(event.status)) {
    return NextResponse.json({ error: 'Événement non disponible.' }, { status: 404 })
  }
  const sessions = await getEventSessions(id)
  return NextResponse.json({ event, sessions })
}

// GET /api/circles/[id] — détails d'un cercle + participants + rotation courante

import { NextResponse } from 'next/server'
import { getCircleDetails, maybeStartLiveBySchedule } from '@/lib/circles'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id || typeof id !== 'string' || id.length < 8) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  // auto-start si scheduled_at dépassé (opportuniste, pas de CRON requis)
  await maybeStartLiveBySchedule(id).catch(() => {})

  const details = await getCircleDetails(id)
  if (!details) {
    return NextResponse.json({ error: 'Cercle introuvable.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, ...details })
}

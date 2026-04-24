// MUKTI G8.4 — CRON rotation rituel hebdo
// Schedule : lundi 06:00 UTC. Crée la semaine courante + la suivante, puis envoie notifs opt-in.
import { NextResponse } from 'next/server'
import { ensureCurrentWeek, ensureNextWeek, themeMetadata } from '@/lib/rituel-hebdo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  return !!req.headers.get('x-vercel-cron')
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  const [current, next] = await Promise.all([ensureCurrentWeek(), ensureNextWeek()])
  const metaCurrent = themeMetadata(current.theme_slug)
  const metaNext = themeMetadata(next.theme_slug)
  return NextResponse.json({
    ok: true,
    current: {
      week_iso: current.week_iso,
      theme: metaCurrent.title_fr,
      color: metaCurrent.color,
    },
    next: {
      week_iso: next.week_iso,
      theme: metaNext.title_fr,
      color: metaNext.color,
    },
    rotated_at: new Date().toISOString(),
  })
}

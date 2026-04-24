// MUKTI G8.4 — Rituel hebdo courant (public, lecture)
import { NextResponse } from 'next/server'
import { ensureCurrentWeek, themeMetadata } from '@/lib/rituel-hebdo'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`rituel-current:${ip}`, 60, 60)
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  const week = await ensureCurrentWeek()
  const meta = themeMetadata(week.theme_slug)
  return NextResponse.json({
    week_iso: week.week_iso,
    theme_slug: week.theme_slug,
    theme_title_fr: meta.title_fr,
    theme_title_en: meta.title_en,
    theme_color: meta.color,
    theme_order: meta.order,
    starts_at: week.starts_at,
    ends_at: week.ends_at,
    participants_count: week.participants_count,
    total_minutes: week.total_minutes,
  }, {
    headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}

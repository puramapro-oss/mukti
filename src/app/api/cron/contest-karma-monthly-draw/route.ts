// MUKTI — G7 CRON tirage mensuel : 10 gagnants hasard actifs × Mulberry32
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { ensureContest, drawMonthlyWinners, distributePrizes } from '@/lib/contests-karma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PRIZE_DISTRIBUTION_MONTHLY = [0.30, 0.20, 0.15, 0.10, 0.06, 0.05, 0.04, 0.04, 0.03, 0.03]

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  return !!req.headers.get('x-vercel-cron')
}

export async function POST(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  const now = new Date()
  // Détecte si on est le dernier jour du mois (heure UTC 23:55 via vercel cron)
  const tomorrow = new Date(now); tomorrow.setUTCDate(now.getUTCDate() + 1)
  const isLastDay = tomorrow.getUTCMonth() !== now.getUTCMonth()
  if (!isLastDay) return NextResponse.json({ ok: true, skipped: 'not last day of month' })
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); end.setUTCMilliseconds(-1)
  const contest = await ensureContest('monthly', start, end)
  const admin = createServiceClient()
  await admin.from('contests_karma').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', contest.id)
  if (contest.pool_cents <= 0) return NextResponse.json({ ok: true, contest_id: contest.id, winners: 0, pool_cents: 0 })
  const drawn = await drawMonthlyWinners(contest.id, 10)
  if (drawn.length === 0) return NextResponse.json({ ok: true, contest_id: contest.id, winners: 0, pool_cents: contest.pool_cents })
  const winners = drawn.map(d => ({
    user_id: d.user_id,
    rank: d.rank,
    prize_cents: Math.floor(contest.pool_cents * (PRIZE_DISTRIBUTION_MONTHLY[d.rank - 1] ?? 0)),
  }))
  await distributePrizes({ contestId: contest.id, winners })
  return NextResponse.json({ ok: true, contest_id: contest.id, winners: winners.length, pool_cents: contest.pool_cents })
}

export async function GET(req: Request) { return POST(req) }

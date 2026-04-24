// MUKTI — G7 CRON annuel : 1er janvier archive N + schedule N+1
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { ensureContest } from '@/lib/contests-karma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  return !!req.headers.get('x-vercel-cron')
}

export async function POST(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  const admin = createServiceClient()
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  // Close previous year contest
  const prevStart = new Date(Date.UTC(currentYear - 1, 0, 1))
  const prevEnd = new Date(Date.UTC(currentYear, 0, 1)); prevEnd.setUTCMilliseconds(-1)
  const prev = await ensureContest('annual', prevStart, prevEnd)
  await admin.from('contests_karma').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', prev.id)
  // Schedule current year
  const curStart = new Date(Date.UTC(currentYear, 0, 1))
  const curEnd = new Date(Date.UTC(currentYear + 1, 0, 1)); curEnd.setUTCMilliseconds(-1)
  const current = await ensureContest('annual', curStart, curEnd)
  await admin.from('contests_karma').update({ status: 'live' }).eq('id', current.id)
  return NextResponse.json({ ok: true, archived: prev.id, scheduled: current.id })
}

export async function GET(req: Request) { return POST(req) }

// CRON : clôture les cercles live dont toutes les rotations prévues sont passées
// (round_number >= max_participants ET pas de rotation active).
// Déclenche status='finished' + finished_at=now. Appelé toutes les 5 minutes.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization') ?? ''
  if (secret && header === `Bearer ${secret}`) return true
  if (req.headers.get('x-vercel-cron')) return true
  return false
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  }

  const service = createServiceClient()

  // Circles live démarrés depuis au moins 3 min
  const threshold = new Date(Date.now() - 3 * 60 * 1000).toISOString()
  const { data: candidates, error: candErr } = await service
    .from('circles')
    .select('id, max_participants, duration_per_person_sec, started_at')
    .eq('status', 'live')
    .lt('started_at', threshold)

  if (candErr) {
    return NextResponse.json({ error: candErr.message }, { status: 500 })
  }

  let closed = 0
  for (const c of (candidates ?? []) as Array<{
    id: string
    max_participants: number
    duration_per_person_sec: number
    started_at: string
  }>) {
    // Compte rotations démarrées
    const { data: rots } = await service
      .from('circle_rotations')
      .select('id, round_number, ended_at')
      .eq('circle_id', c.id)
      .order('round_number', { ascending: false })
      .limit(1)

    const last = (rots ?? [])[0] as { round_number: number; ended_at: string | null } | undefined
    if (!last) continue

    // Si tous les rounds prévus sont passés et le dernier est fermé → clôturer
    const totalExpected = c.max_participants
    const allDone = last.round_number >= totalExpected && last.ended_at !== null
    if (!allDone) continue

    await service
      .from('circles')
      .update({ status: 'finished', finished_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('status', 'live')
    closed += 1
  }

  // Aussi clôture "orphelins" : circles live sans activité depuis 2h
  const orphanThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: orphans } = await service
    .from('circles')
    .select('id')
    .eq('status', 'live')
    .lt('started_at', orphanThreshold)

  let orphanClosed = 0
  for (const o of (orphans ?? []) as Array<{ id: string }>) {
    await service
      .from('circles')
      .update({ status: 'finished', finished_at: new Date().toISOString() })
      .eq('id', o.id)
      .eq('status', 'live')
    orphanClosed += 1
  }

  return NextResponse.json({
    ok: true,
    closed_rounds_done: closed,
    closed_orphans: orphanClosed,
    inspected: (candidates ?? []).length,
  })
}

export async function GET(req: Request) {
  return POST(req)
}

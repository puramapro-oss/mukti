// CRON : alerte push si dernière entrée journal mental a relapse_risk > 0.75
// et n'a pas encore été "alertée" (alerted_at NULL) + < 6h.
// Appelé toutes les heures.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD } from '@/lib/constants'

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
  try {
    const sb = createServiceClient()
    const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString()
    const { data: flagged } = await sb
      .schema('mukti')
      .from('mental_journal_entries')
      .select('id, user_id, relapse_risk, created_at')
      .gt('relapse_risk', MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD)
      .is('alerted_at', null)
      .gte('created_at', sixHoursAgo)
      .order('created_at', { ascending: false })
      .limit(50)

    const rows = (flagged ?? []) as {
      id: string
      user_id: string
      relapse_risk: number
      created_at: string
    }[]

    let alerted = 0
    const notified = new Set<string>()
    for (const row of rows) {
      if (notified.has(row.user_id)) continue
      notified.add(row.user_id)

      // Créer notification in-app (table mukti.notifications)
      await sb.schema('mukti').from('notifications').insert({
        user_id: row.user_id,
        type: 'relapse_risk',
        title: 'MUKTI est là pour toi',
        body: `Ton dernier journal indique un moment difficile. Ouvre une session Boucle Urgence ou Rituel 7s — tu peux traverser ça.`,
        link: '/dashboard/boucle-urgence',
        metadata: { relapse_risk: row.relapse_risk, entry_id: row.id },
      })
      await sb
        .schema('mukti')
        .from('mental_journal_entries')
        .update({ alerted_at: new Date().toISOString() })
        .eq('id', row.id)
      alerted += 1
    }

    return NextResponse.json({ ok: true, alerted, candidates: rows.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'CRON failure.' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  return POST(req)
}

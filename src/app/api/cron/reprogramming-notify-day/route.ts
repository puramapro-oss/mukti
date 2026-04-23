// CRON Mode Journée — Vercel schedule `0 9,11,13,15,17,19 * * *` UTC.
// À chaque tick : pour chaque user opt-in (profiles.notifs.reprog_day_reminders === true),
// si le slot actuel est bien dans [9,11,13,15,17,19] UTC et que la dernière notif de ce type
// est vieille de > 110 min, insert mukti.notifications (type = reprog_day_reminder).
//
// Authz : Bearer CRON_SECRET OU header x-vercel-cron (plan Vercel Cron).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { REPROG_DAY_REMINDER_HOURS } from '@/lib/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization') ?? ''
  if (secret && header === `Bearer ${secret}`) return true
  if (req.headers.get('x-vercel-cron')) return true
  return false
}

// Titres/bodies tournants pour varier le ton (FR, bienveillant, non-prosélyte)
const NUDGES: Array<{ title: string; body: string }> = [
  {
    title: 'Une pause pour toi',
    body: '2 minutes pour poser une affirmation. Rien d\'autre, rien à faire.',
  },
  {
    title: 'Reviens à toi',
    body: 'Un souffle, une phrase. Tu choisis la catégorie, l\'app tourne pour toi.',
  },
  {
    title: 'Ton rappel doux',
    body: 'Tu peux poser quelques affirmations maintenant. C\'est court, c\'est pour toi.',
  },
  {
    title: 'Un instant de reprogrammation',
    body: 'Quelques minutes en mode journée — tu sais ce qui te fait du bien.',
  },
  {
    title: 'Ta respiration',
    body: 'Ouvre Mode Journée, laisse les affirmations passer. Rien d\'obligatoire.',
  },
]

function pickNudge(hour: number) {
  const idx = hour % NUDGES.length
  return NUDGES[idx]
}

const COOLDOWN_MINUTES = 110

async function run(): Promise<{
  created: number
  skipped_cooldown: number
  skipped_recent_session: number
  errors: number
  slot_utc: number | null
}> {
  const now = new Date()
  const slot = now.getUTCHours()
  const slotMinute = now.getUTCMinutes()

  // On tolère ±5 min autour de l'heure pile pour absorber le drift Vercel
  const inSlot =
    (REPROG_DAY_REMINDER_HOURS as readonly number[]).includes(slot) && slotMinute <= 10

  if (!inSlot) {
    return {
      created: 0,
      skipped_cooldown: 0,
      skipped_recent_session: 0,
      errors: 0,
      slot_utc: null,
    }
  }

  const service = createServiceClient()

  // Récupère tous les users opt-in (notifs.reprog_day_reminders = true)
  const { data: profiles, error: profilesErr } = await service
    .schema('mukti')
    .from('profiles')
    .select('id, notifs')
    .filter('notifs->>reprog_day_reminders', 'eq', 'true')
    .limit(10000)

  if (profilesErr) {
    throw new Error(`profiles.load: ${profilesErr.message}`)
  }

  const eligible = (profiles ?? []) as Array<{
    id: string
    notifs: Record<string, unknown> | null
  }>

  if (eligible.length === 0) {
    return {
      created: 0,
      skipped_cooldown: 0,
      skipped_recent_session: 0,
      errors: 0,
      slot_utc: slot,
    }
  }

  const nudge = pickNudge(slot)
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MINUTES * 60 * 1000).toISOString()

  let created = 0
  let skippedCooldown = 0
  let skippedRecentSession = 0
  let errors = 0

  // Fetch all recent notifs + sessions en 2 requêtes batch pour éviter N+1
  const userIds = eligible.map((p) => p.id)

  const [notifsRes, sessionsRes] = await Promise.all([
    service
      .schema('mukti')
      .from('notifications')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .eq('type', 'reprog_day_reminder')
      .gt('created_at', cooldownCutoff),
    service
      .schema('mukti')
      .from('reprogramming_sessions')
      .select('user_id, started_at')
      .in('user_id', userIds)
      .eq('mode', 'day')
      .gt('started_at', cooldownCutoff),
  ])

  const recentNotifUsers = new Set(
    ((notifsRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
  )
  const recentSessionUsers = new Set(
    ((sessionsRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
  )

  const toInsert: Array<{
    user_id: string
    type: string
    title: string
    body: string
    link: string
    metadata: Record<string, unknown>
  }> = []

  for (const p of eligible) {
    if (recentNotifUsers.has(p.id)) {
      skippedCooldown += 1
      continue
    }
    if (recentSessionUsers.has(p.id)) {
      skippedRecentSession += 1
      continue
    }
    toInsert.push({
      user_id: p.id,
      type: 'reprog_day_reminder',
      title: nudge.title,
      body: nudge.body,
      link: '/dashboard/subconscient/journee',
      metadata: { slot_utc: slot },
    })
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await service
      .schema('mukti')
      .from('notifications')
      .insert(toInsert)
    if (insertErr) {
      errors = toInsert.length
    } else {
      created = toInsert.length
    }
  }

  return {
    created,
    skipped_cooldown: skippedCooldown,
    skipped_recent_session: skippedRecentSession,
    errors,
    slot_utc: slot,
  }
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json(
      { error: 'Accès refusé. Cette route est réservée au planificateur.' },
      { status: 401 }
    )
  }
  try {
    const result = await run()
    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      ...result,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'inconnu'
    return NextResponse.json({ ok: false, error: `Échec CRON — ${msg}` }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}

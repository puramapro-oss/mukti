// MUKTI — G7 Wealth Engine Phase 1 : feed anonymisé + impact stats

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import type { MagicMomentKind } from './constants'

export async function recordMagicMoment(params: {
  userId: string
  kind: MagicMomentKind
  payload?: Record<string, unknown>
}): Promise<void> {
  const admin = createServiceClient()
  await admin.from('magic_moments').insert({
    user_id: params.userId,
    kind: params.kind,
    payload: params.payload ?? {},
  })
}

export async function recordMagicMomentForCurrentUser(
  kind: MagicMomentKind,
  payload?: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  const sb = await createServerSupabaseClient()
  const userId = await resolveProfileId(sb)
  if (!userId) return { ok: false }
  await recordMagicMoment({ userId, kind, payload })
  return { ok: true }
}

export interface FeedItem {
  id: string
  kind: MagicMomentKind
  first_name: string
  message_fr: string
  message_en: string
  created_at: string
}

const FIRST_NAMES_POOL = [
  'Alex', 'Léa', 'Marc', 'Sarah', 'Yanis', 'Sophie', 'Hugo', 'Emma',
  'Noé', 'Chloé', 'Maël', 'Jade', 'Tom', 'Louise', 'Nathan', 'Camille',
  'Lucas', 'Zoé', 'Gabriel', 'Eva',
]

function pickName(userId: string): string {
  const hash = Array.from(userId).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  return FIRST_NAMES_POOL[hash % FIRST_NAMES_POOL.length] ?? 'Anonyme'
}

function buildMessage(kind: MagicMomentKind, name: string, lang: 'fr' | 'en'): string {
  const fr: Record<MagicMomentKind, string> = {
    signup: `${name} a rejoint MUKTI.`,
    first_payment: `${name} a débloqué tout l'écosystème.`,
    streak_7d: `${name} enchaîne 7 jours sans addiction.`,
    streak_30d: `${name} enchaîne 30 jours — bravo.`,
    streak_100d: `${name} traverse un cap de 100 jours.`,
    addiction_freed: `${name} a déclaré libération complète.`,
    circle_joined: `${name} a rejoint un Cercle d'Intention.`,
    referral_success: `${name} a aidé un ami à commencer.`,
    ambassador_upgrade: `${name} devient ambassadeur.`,
    ritual_7s_completed: `${name} a pratiqué le Rituel 7 secondes.`,
    aurora_completed: `${name} a terminé une session AURORA.`,
    core_event_joined: `${name} a rejoint un événement C.O.R.E.`,
    contest_winner: `${name} figure parmi les récompensés.`,
  }
  const en: Record<MagicMomentKind, string> = {
    signup: `${name} joined MUKTI.`,
    first_payment: `${name} unlocked the full ecosystem.`,
    streak_7d: `${name} reached 7 days addiction-free.`,
    streak_30d: `${name} reached 30 days — beautiful.`,
    streak_100d: `${name} crossed a 100-day milestone.`,
    addiction_freed: `${name} declared full liberation.`,
    circle_joined: `${name} joined an Intention Circle.`,
    referral_success: `${name} helped a friend start.`,
    ambassador_upgrade: `${name} became an ambassador.`,
    ritual_7s_completed: `${name} practiced the 7-second Ritual.`,
    aurora_completed: `${name} completed an AURORA session.`,
    core_event_joined: `${name} joined a C.O.R.E. event.`,
    contest_winner: `${name} is among the rewarded.`,
  }
  return (lang === 'en' ? en : fr)[kind] ?? ''
}

export async function getAnonymizedFeed(limit = 20): Promise<FeedItem[]> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('magic_moments')
    .select('id, user_id, kind, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as Array<{ id: string; user_id: string; kind: MagicMomentKind; created_at: string }>
  return rows.map(r => {
    const name = pickName(r.user_id)
    return {
      id: r.id,
      kind: r.kind,
      first_name: name,
      message_fr: buildMessage(r.kind, name, 'fr'),
      message_en: buildMessage(r.kind, name, 'en'),
      created_at: r.created_at,
    }
  })
}

export interface ImpactStats {
  total_users: number
  total_redistributed_cents: number
  total_addictions_freed: number
  total_core_events: number
  total_circle_sessions: number
  updated_at: string
}

let cachedStats: { value: ImpactStats; expiresAt: number } | null = null

export async function getImpactStats(force = false): Promise<ImpactStats> {
  if (!force && cachedStats && cachedStats.expiresAt > Date.now()) return cachedStats.value
  const admin = createServiceClient()
  const [
    { count: totalUsers },
    { data: splits },
    { count: totalFreed },
    { count: totalCore },
    { count: totalCircles },
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('payments').select('split_user_cents, split_asso_cents').eq('status', 'paid'),
    admin.from('magic_moments').select('id', { count: 'exact', head: true }).eq('kind', 'addiction_freed'),
    admin.from('core_events').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
    admin.from('circle_sessions').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
  ])
  const redistributed = ((splits ?? []) as Array<{ split_user_cents: number; split_asso_cents: number }>)
    .reduce((a, r) => a + (r.split_user_cents ?? 0) + (r.split_asso_cents ?? 0), 0)
  const value: ImpactStats = {
    total_users: totalUsers ?? 0,
    total_redistributed_cents: redistributed,
    total_addictions_freed: totalFreed ?? 0,
    total_core_events: totalCore ?? 0,
    total_circle_sessions: totalCircles ?? 0,
    updated_at: new Date().toISOString(),
  }
  cachedStats = { value, expiresAt: Date.now() + 60 * 60 * 1000 } // 1h
  return value
}

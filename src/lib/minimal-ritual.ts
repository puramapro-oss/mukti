// MUKTI — G6 Mode 19 Rituel Minimaliste
// 8 micro-habitudes invisibles (10-60s). 1 tick/user/habit/date.

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { MINIMAL_RITUAL_HABITS, type MinimalRitualHabit } from './constants'

export interface MinimalTick {
  id: string
  user_id: string
  habit_slug: MinimalRitualHabit
  tick_date: string
  tick_at: string
}

export interface HabitStatus {
  slug: MinimalRitualHabit
  ticked_today: boolean
  streak_days: number
}

export function isMinimalHabit(v: string): v is MinimalRitualHabit {
  return (MINIMAL_RITUAL_HABITS as readonly { slug: string }[]).some(h => h.slug === v)
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

/** Tick a habit today (idempotent via UNIQUE user+habit+date). */
export async function tickHabit(slug: string): Promise<{
  ticked: boolean
  already: boolean
  error: string | null
}> {
  if (!isMinimalHabit(slug)) {
    return { ticked: false, already: false, error: 'Habitude invalide.' }
  }
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return { ticked: false, already: false, error: 'Profil introuvable — reconnecte-toi.' }

  const sb = createServiceClient()
  const date = todayUtc()
  const { data: existing } = await sb
    .schema('mukti')
    .from('minimal_ritual_ticks')
    .select('id')
    .eq('user_id', profileId)
    .eq('habit_slug', slug)
    .eq('tick_date', date)
    .maybeSingle()
  if (existing) {
    return { ticked: true, already: true, error: null }
  }

  const { error } = await sb.schema('mukti').from('minimal_ritual_ticks').insert({
    user_id: profileId,
    habit_slug: slug,
    tick_date: date,
  })
  if (error) {
    // Race : treat as already
    return { ticked: true, already: true, error: null }
  }
  return { ticked: true, already: false, error: null }
}

/** Status of all 8 habits today (ticked + streak). */
export async function todayStatus(): Promise<HabitStatus[]> {
  const supabase = await createServerSupabaseClient()
  const profileId = await resolveProfileId(supabase)
  if (!profileId) return []

  const sb = createServiceClient()
  const date = todayUtc()
  const { data } = await sb
    .schema('mukti')
    .from('minimal_ritual_ticks')
    .select('habit_slug, tick_date')
    .eq('user_id', profileId)
    .order('tick_date', { ascending: false })
    .limit(500)

  const rows = (data ?? []) as { habit_slug: string; tick_date: string }[]
  return MINIMAL_RITUAL_HABITS.map(h => {
    const habitRows = rows.filter(r => r.habit_slug === h.slug).map(r => r.tick_date)
    const tickedToday = habitRows.includes(date)
    let streak = 0
    if (tickedToday) {
      let cursor = date
      for (const d of habitRows) {
        if (d === cursor) {
          streak += 1
          const prev = new Date(cursor)
          prev.setUTCDate(prev.getUTCDate() - 1)
          cursor = prev.toISOString().slice(0, 10)
        } else if (daysBetween(cursor, d) > 0) {
          break
        }
      }
    }
    return { slug: h.slug, ticked_today: tickedToday, streak_days: streak }
  })
}

async function resolveProfileId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .schema('mukti')
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

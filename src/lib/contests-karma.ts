// MUKTI — G7 Concours KARMA : hebdo 6% / mensuel 4% / annuel + OTS règlement

import { createServiceClient } from './supabase'
import { CONTEST_PERIODS, type ContestPeriod } from './constants'
import { stampHash, sha256Hex } from './opentimestamps'

export interface ContestKarma {
  id: string
  period: ContestPeriod
  start_at: string
  end_at: string
  pool_cents: number
  rules_pdf_url: string | null
  ots_proof_url: string | null
  ots_sha256: string | null
  winners_count: number
  status: 'upcoming' | 'live' | 'closed' | 'paid'
  closed_at: string | null
}

export async function getCurrentContest(period: ContestPeriod): Promise<ContestKarma | null> {
  const admin = createServiceClient()
  const now = new Date().toISOString()
  const { data } = await admin
    .from('contests_karma')
    .select('*')
    .eq('period', period)
    .lte('start_at', now)
    .gte('end_at', now)
    .maybeSingle()
  return (data as unknown as ContestKarma | null) ?? null
}

export async function getUpcomingContest(period: ContestPeriod): Promise<ContestKarma | null> {
  const admin = createServiceClient()
  const now = new Date().toISOString()
  const { data } = await admin
    .from('contests_karma')
    .select('*')
    .eq('period', period)
    .gt('start_at', now)
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as unknown as ContestKarma | null) ?? null
}

export async function ensureContest(period: ContestPeriod, startAt: Date, endAt: Date): Promise<ContestKarma> {
  const admin = createServiceClient()
  const cfg = CONTEST_PERIODS.find(p => p.id === period)!
  const { data } = await admin
    .from('contests_karma')
    .upsert({
      period,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      winners_count: cfg.winners,
      status: 'upcoming',
    }, { onConflict: 'period,start_at' })
    .select('*')
    .single()
  return data as unknown as ContestKarma
}

export async function addToPool(contestId: string, amountCents: number): Promise<void> {
  const admin = createServiceClient()
  const { data: current } = await admin
    .from('contests_karma')
    .select('pool_cents')
    .eq('id', contestId)
    .maybeSingle()
  const prev = ((current as { pool_cents: number } | null)?.pool_cents) ?? 0
  await admin.from('contests_karma').update({ pool_cents: prev + amountCents }).eq('id', contestId)
}

export async function computeWeeklyRanking(contestId: string, limit = 10): Promise<Array<{ user_id: string; score: number }>> {
  const admin = createServiceClient()
  const { data: contest } = await admin
    .from('contests_karma')
    .select('start_at, end_at')
    .eq('id', contestId)
    .maybeSingle()
  if (!contest) return []
  const c = contest as { start_at: string; end_at: string }
  const { data: moments } = await admin
    .from('magic_moments')
    .select('user_id, kind')
    .gte('created_at', c.start_at)
    .lte('created_at', c.end_at)
  const scoreMap = new Map<string, number>()
  const kindWeights: Record<string, number> = {
    signup: 1, first_payment: 10, referral_success: 5,
    streak_7d: 2, streak_30d: 5, streak_100d: 15,
    addiction_freed: 20, circle_joined: 1, ambassador_upgrade: 8,
    ritual_7s_completed: 1, aurora_completed: 1, core_event_joined: 2,
  }
  for (const row of (moments ?? []) as Array<{ user_id: string; kind: string }>) {
    const w = kindWeights[row.kind] ?? 1
    scoreMap.set(row.user_id, (scoreMap.get(row.user_id) ?? 0) + w)
  }
  const sorted = Array.from(scoreMap.entries())
    .map(([user_id, score]) => ({ user_id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return sorted
}

// Mulberry32 deterministic PRNG for audit fairness
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function drawMonthlyWinners(contestId: string, count = 10): Promise<Array<{ user_id: string; rank: number }>> {
  const admin = createServiceClient()
  const { data: contest } = await admin
    .from('contests_karma')
    .select('start_at, end_at')
    .eq('id', contestId)
    .maybeSingle()
  if (!contest) return []
  const c = contest as { start_at: string; end_at: string }
  // Pool = users actifs (au moins 1 magic_moment) sur la période
  const { data: moments } = await admin
    .from('magic_moments')
    .select('user_id')
    .gte('created_at', c.start_at)
    .lte('created_at', c.end_at)
  const uniqueUsers = Array.from(new Set((moments ?? []).map(m => (m as { user_id: string }).user_id)))
  if (uniqueUsers.length === 0) return []
  // Seed deterministic : hash(contest_id)
  const seed = Array.from(contestId).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 1)
  const rand = mulberry32(seed)
  const pool = [...uniqueUsers]
  const winners: Array<{ user_id: string; rank: number }> = []
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const idx = Math.floor(rand() * pool.length)
    const [picked] = pool.splice(idx, 1)
    winners.push({ user_id: picked, rank: i + 1 })
  }
  return winners
}

export async function stampRulesPdfOTS(pdfBuffer: Buffer): Promise<{ sha256: string; proofBase64: string | null }> {
  const sha256 = sha256Hex(pdfBuffer)
  const proofBase64 = await stampHash(sha256)
  return { sha256, proofBase64 }
}

export async function distributePrizes(params: {
  contestId: string
  winners: Array<{ user_id: string; rank: number; prize_cents: number }>
}): Promise<void> {
  const admin = createServiceClient()
  for (const w of params.winners) {
    await admin.from('contest_entries').upsert({
      contest_id: params.contestId,
      user_id: w.user_id,
      rank: w.rank,
      prize_cents: w.prize_cents,
      paid_at: new Date().toISOString(),
    }, { onConflict: 'contest_id,user_id' })
    // Credit wallet
    const { data: p } = await admin.from('profiles').select('wallet_balance_cents').eq('id', w.user_id).maybeSingle()
    const prev = ((p as { wallet_balance_cents: number } | null)?.wallet_balance_cents) ?? 0
    await admin.from('profiles').update({ wallet_balance_cents: prev + w.prize_cents }).eq('id', w.user_id)
    // Magic moment
    await admin.from('magic_moments').insert({
      user_id: w.user_id,
      kind: 'contest_winner',
      payload: { rank: w.rank, contest_id: params.contestId },
    })
  }
  await admin.from('contests_karma').update({ status: 'paid', closed_at: new Date().toISOString() }).eq('id', params.contestId)
}

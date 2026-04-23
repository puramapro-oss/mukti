import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PRIZE_DISTRIBUTION = [0.33, 0.17, 0.12, 0.08, 0.07, 0.05, 0.045, 0.045, 0.045, 0.045]

interface ScoreRow {
  user_id: string
  score: number
  full_name: string | null
  email: string
}

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  if (header === `Bearer ${secret}`) return true
  const vercelHeader = request.headers.get('x-vercel-cron')
  if (vercelHeader) return true
  return false
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json(
      { error: "Accès refusé. Cette route est réservée au planificateur." },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()

  const nowIso = new Date().toISOString()
  const { data: contests, error: contestsErr } = await supabase
    .from('contests')
    .select('id, title, type, total_pool_cents, end_date, status')
    .eq('type', 'weekly')
    .eq('status', 'live')
    .lte('end_date', nowIso)

  if (contestsErr) {
    return NextResponse.json(
      { error: 'Erreur lors de la lecture des concours.', details: contestsErr.message },
      { status: 500 }
    )
  }

  if (!contests || contests.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'Aucun concours hebdo à clôturer.' })
  }

  const results: Array<{ contest_id: string; winners_count: number; total_paid_cents: number }> = []

  for (const contest of contests) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, total_demarches_launched, streak_days, level')
      .gte('updated_at', sevenDaysAgo)
      .order('total_demarches_launched', { ascending: false })
      .limit(500)

    if (profilesErr || !profiles || profiles.length === 0) {
      await supabase
        .from('contests')
        .update({ status: 'completed', winners: [] })
        .eq('id', contest.id)
      results.push({ contest_id: contest.id, winners_count: 0, total_paid_cents: 0 })
      continue
    }

    const userIds = profiles.map((p) => p.id)

    const [{ data: refs }, { data: missionsDone }, { data: scansDone }] = await Promise.all([
      supabase
        .from('referrals')
        .select('referrer_id')
        .in('referrer_id', userIds)
        .gte('created_at', sevenDaysAgo),
      supabase
        .from('mission_completions')
        .select('user_id')
        .in('user_id', userIds)
        .gte('created_at', sevenDaysAgo),
      supabase
        .from('scans')
        .select('user_id')
        .in('user_id', userIds)
        .gte('created_at', sevenDaysAgo),
    ])

    const refCount = new Map<string, number>()
    refs?.forEach((r: { referrer_id: string }) => {
      refCount.set(r.referrer_id, (refCount.get(r.referrer_id) ?? 0) + 1)
    })
    const missionCount = new Map<string, number>()
    missionsDone?.forEach((m: { user_id: string }) => {
      missionCount.set(m.user_id, (missionCount.get(m.user_id) ?? 0) + 1)
    })
    const scanCount = new Map<string, number>()
    scansDone?.forEach((s: { user_id: string }) => {
      scanCount.set(s.user_id, (scanCount.get(s.user_id) ?? 0) + 1)
    })

    const scored: ScoreRow[] = profiles.map((p) => {
      const r = refCount.get(p.id) ?? 0
      const m = missionCount.get(p.id) ?? 0
      const s = scanCount.get(p.id) ?? 0
      const score = r * 10 + m * 3 + s * 2 + (p.streak_days ?? 0) + (p.level ?? 1)
      return {
        user_id: p.id,
        score,
        full_name: p.full_name,
        email: p.email,
      }
    })

    scored.sort((a, b) => b.score - a.score)
    const winners = scored.slice(0, 10).filter((w) => w.score > 0)

    if (winners.length === 0) {
      await supabase
        .from('contests')
        .update({ status: 'completed', winners: [] })
        .eq('id', contest.id)
      results.push({ contest_id: contest.id, winners_count: 0, total_paid_cents: 0 })
      continue
    }

    const totalPoolCents = contest.total_pool_cents ?? 0
    const winnersPayload: Array<{
      rank: number
      user_id: string
      name: string | null
      score: number
      amount_cents: number
    }> = []

    let totalPaidCents = 0

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i]
      const ratio = PRIZE_DISTRIBUTION[i] ?? 0
      const amountCents = Math.floor(totalPoolCents * ratio)
      const amountEuros = amountCents / 100

      winnersPayload.push({
        rank: i + 1,
        user_id: winner.user_id,
        name: winner.full_name,
        score: winner.score,
        amount_cents: amountCents,
      })
      totalPaidCents += amountCents

      if (amountEuros > 0) {
        await supabase.from('wallet_transactions').insert({
          user_id: winner.user_id,
          amount: amountEuros,
          type: 'contest_prize',
          description: `Concours hebdo : ${contest.title} — rang ${i + 1}`,
          status: 'completed',
          source_id: contest.id,
          metadata: { contest_id: contest.id, rank: i + 1, score: winner.score },
        })

        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', winner.user_id)
          .single()

        const currentBalance = Number(profile?.wallet_balance ?? 0)
        await supabase
          .from('profiles')
          .update({ wallet_balance: currentBalance + amountEuros })
          .eq('id', winner.user_id)
      }

      await supabase.from('notifications').insert({
        user_id: winner.user_id,
        type: 'contest_won',
        title: `🏆 Top ${i + 1} du concours hebdo !`,
        body:
          amountEuros > 0
            ? `Tu remportes ${amountEuros.toFixed(2)} € sur ${contest.title}. Crédité sur ton wallet.`
            : `Tu termines au top ${i + 1} sur ${contest.title}. Bravo !`,
        action_url: '/wallet',
        icon: '🏆',
      })
    }

    await supabase
      .from('contests')
      .update({
        status: 'completed',
        winners: winnersPayload,
      })
      .eq('id', contest.id)

    results.push({
      contest_id: contest.id,
      winners_count: winners.length,
      total_paid_cents: totalPaidCents,
    })
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
    timestamp: nowIso,
  })
}

export async function GET(request: Request) {
  return POST(request)
}

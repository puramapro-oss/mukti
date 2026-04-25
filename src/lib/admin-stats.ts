// MUKTI G8.6 — Stats live admin : CA Stripe brut + split 50/10/40 + churn + top régions

import { createServiceClient } from './supabase'
import { isSuperAdminCurrentUser } from './admin-settings'

export interface StatsLive {
  ca: {
    total_cents: number
    month_cents: number
    day_cents: number
    refunded_cents: number
  }
  split: {
    pool_user_cents: number
    asso_cents: number
    sasu_cents: number
  }
  users: {
    total: number
    premium_active: number
    super_admin: number
    last_30d: number
  }
  churn: {
    canceled_this_month: number
    active_start_of_month: number
    rate_pct: number
  }
  top_countries: Array<{ code: string; count: number }>
  generated_at: string
}

function startOfMonthIso(): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfDayIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function thirtyDaysAgoIso(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 30)
  return d.toISOString()
}

interface PaymentRow {
  amount_cents: number
  split_user_cents: number
  split_asso_cents: number
  split_sasu_cents: number
  status: string
  paid_at: string | null
}

export async function getStatsLive(): Promise<StatsLive | null> {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) return null
  const admin = createServiceClient()
  const monthStart = startOfMonthIso()
  const dayStart = startOfDayIso()
  const last30 = thirtyDaysAgoIso()

  const [paymentsAll, paymentsMonth, paymentsDay, paymentsRefunded, usersTotal, usersPremium, usersSuperAdmin, usersLast30, subsCanceledMonth, subsActiveStart, countriesAgg] = await Promise.all([
    admin.from('payments').select('amount_cents, split_user_cents, split_asso_cents, split_sasu_cents, status, paid_at').eq('status', 'paid'),
    admin.from('payments').select('amount_cents').eq('status', 'paid').gte('paid_at', monthStart),
    admin.from('payments').select('amount_cents').eq('status', 'paid').gte('paid_at', dayStart),
    admin.from('payments').select('amount_cents').eq('status', 'refunded'),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).in('status', ['active', 'trialing']),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'super_admin'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last30),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'canceled').gte('canceled_at', monthStart),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).in('status', ['active', 'trialing', 'canceled']).lte('created_at', monthStart),
    admin.from('profiles').select('country_code'),
  ])

  const allPayments = (paymentsAll.data ?? []) as PaymentRow[]
  const ca_total_cents = allPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
  const split_user = allPayments.reduce((s, p) => s + (p.split_user_cents ?? 0), 0)
  const split_asso = allPayments.reduce((s, p) => s + (p.split_asso_cents ?? 0), 0)
  const split_sasu = allPayments.reduce((s, p) => s + (p.split_sasu_cents ?? 0), 0)

  const ca_month_cents = (((paymentsMonth.data ?? []) as { amount_cents: number }[]).reduce((s, p) => s + (p.amount_cents ?? 0), 0))
  const ca_day_cents = (((paymentsDay.data ?? []) as { amount_cents: number }[]).reduce((s, p) => s + (p.amount_cents ?? 0), 0))
  const refunded_cents = (((paymentsRefunded.data ?? []) as { amount_cents: number }[]).reduce((s, p) => s + (p.amount_cents ?? 0), 0))

  const counts: Record<string, number> = {}
  for (const row of (countriesAgg.data ?? []) as Array<{ country_code: string | null }>) {
    const code = row.country_code || 'INT'
    counts[code] = (counts[code] ?? 0) + 1
  }
  const top_countries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }))

  const canceled = subsCanceledMonth.count ?? 0
  const activeStart = subsActiveStart.count ?? 1
  const churn_rate_pct = activeStart > 0 ? Math.round((canceled / activeStart) * 1000) / 10 : 0

  return {
    ca: { total_cents: ca_total_cents, month_cents: ca_month_cents, day_cents: ca_day_cents, refunded_cents },
    split: { pool_user_cents: split_user, asso_cents: split_asso, sasu_cents: split_sasu },
    users: {
      total: usersTotal.count ?? 0,
      premium_active: usersPremium.count ?? 0,
      super_admin: usersSuperAdmin.count ?? 0,
      last_30d: usersLast30.count ?? 0,
    },
    churn: {
      canceled_this_month: canceled,
      active_start_of_month: activeStart,
      rate_pct: churn_rate_pct,
    },
    top_countries,
    generated_at: new Date().toISOString(),
  }
}

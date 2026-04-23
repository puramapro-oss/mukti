'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Search, MessageSquare, Coins, TrendingUp, Wallet, ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import { formatEurosFraction } from '@/lib/utils'

interface Stats {
  total_users: number
  total_scans: number
  total_messages: number
  total_recovered: number
  premium_users: number
}

export default function AdminPage() {
  const router = useRouter()
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!isSuperAdmin) {
      router.replace('/dashboard')
      return
    }
    const sb = createClient()
    Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('scans').select('id', { count: 'exact', head: true }),
      sb.from('messages').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('total_money_recovered, subscription_plan'),
    ]).then(([users, scans, messages, profiles]) => {
      const totalRecovered = (profiles.data ?? []).reduce(
        (s: number, p: { total_money_recovered: number | null }) => s + Number(p.total_money_recovered ?? 0),
        0,
      )
      const premium = (profiles.data ?? []).filter((p: { subscription_plan: string }) => p.subscription_plan === 'premium').length
      setStats({
        total_users: users.count ?? 0,
        total_scans: scans.count ?? 0,
        total_messages: messages.count ?? 0,
        total_recovered: totalRecovered,
        premium_users: premium,
      })
      setLoading(false)
    })
  }, [authLoading, isSuperAdmin, router])

  if (!isSuperAdmin) return null

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-testid="admin-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Vue d&apos;ensemble MUKTI.</p>
      </header>

      {loading || !stats ? (
        <Card className="p-8 text-center text-sm text-[var(--text-muted)]">Chargement…</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={Users} label="Utilisateurs" value={String(stats.total_users)} />
          <StatCard icon={Coins} label="Premium" value={String(stats.premium_users)} />
          <StatCard icon={Search} label="Scans réalisés" value={String(stats.total_scans)} />
          <StatCard icon={MessageSquare} label="Messages chat" value={String(stats.total_messages)} />
          <StatCard icon={TrendingUp} label="€ récupérés" value={formatEurosFraction(stats.total_recovered)} />
        </div>
      )}

      <Link
        href="/dashboard/admin/financement"
        data-testid="admin-link-financement"
        className="group flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/[0.04]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
            <Wallet className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              Financement pools
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Reward · Asso · Partner — aides, subventions, dépôts
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
      </Link>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card className="p-5">
      <Icon className="mb-2 h-6 w-6 text-[var(--cyan)]" />
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </Card>
  )
}

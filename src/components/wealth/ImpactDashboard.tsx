'use client'

import { useEffect, useState } from 'react'
import { Users, Heart, Globe, Coins } from 'lucide-react'

interface Stats {
  total_users: number
  total_redistributed_cents: number
  total_addictions_freed: number
  total_core_events: number
  total_circle_sessions: number
}

export default function ImpactDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/wealth/impact-stats')
      .then(r => r.json())
      .then(d => setStats(d as Stats))
      .catch(() => null)
  }, [])

  const cards = [
    { icon: Users, label: 'Membres', value: stats?.total_users ?? 0, color: 'text-violet-400' },
    {
      icon: Coins, label: 'Redistribué',
      value: stats ? `${(stats.total_redistributed_cents / 100).toFixed(0)}€` : '0€',
      color: 'text-amber-400',
    },
    { icon: Heart, label: 'Libérations', value: stats?.total_addictions_freed ?? 0, color: 'text-pink-400' },
    { icon: Globe, label: 'Événements C.O.R.E.', value: stats?.total_core_events ?? 0, color: 'text-cyan-400' },
  ]

  return (
    <section data-testid="impact-dashboard" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <Icon className={`h-6 w-6 ${color} mb-3`} />
          <div className="text-3xl font-bold tabular-nums">{value}</div>
          <div className="text-white/60 text-sm mt-1">{label}</div>
        </div>
      ))}
    </section>
  )
}

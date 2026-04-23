'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import type { Notification } from '@/types'

export default function NotificationsPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const sb = createClient()
    sb.from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setItems((data ?? []) as Notification[])
        setLoading(false)
      })
  }, [profile])

  async function markAllRead() {
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="notifications-page">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Notifications</h1>
        {items.some((i) => !i.read) && (
          <Button size="sm" variant="secondary" onClick={markAllRead}>
            <Check className="h-4 w-4" /> Tout lire
          </Button>
        )}
      </header>

      {loading ? (
        <Card className="p-8 text-center text-sm text-[var(--text-muted)]">Chargement…</Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">Aucune notification pour le moment.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const inner = (
              <Card className={`p-4 ${!n.read ? 'border-[var(--cyan)]/40 bg-[var(--cyan)]/[0.03]' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{n.icon ?? '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--text-primary)]">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{n.body}</p>}
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {new Date(n.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </Card>
            )
            return n.action_url ? (
              <Link key={n.id} href={n.action_url}>
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface FeedItem {
  id: string
  kind: string
  first_name: string
  message_fr: string
  created_at: string
}

export default function SocialFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wealth/feed')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.feed)) setItems(d.feed as FeedItem[])
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 bg-white/5 rounded" />)}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/50 text-sm">
        La communauté se met en mouvement. Sois le premier !
      </div>
    )
  }

  return (
    <section data-testid="social-feed" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <h3 className="font-semibold text-white/80">Ça bouge maintenant</h3>
      </div>
      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.id} className="flex gap-3 items-start text-sm">
            <span className="h-2 w-2 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
            <div>
              <div className="text-white/80">{item.message_fr}</div>
              <div className="text-xs text-white/40 mt-0.5">
                {new Date(item.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Bell, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getGreeting, getInitials } from '@/lib/utils'

export default function Topbar() {
  const { profile } = useAuth()
  const [greeting, setGreeting] = useState('Bonjour')
  useEffect(() => { setGreeting(getGreeting()) }, [])

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-nebula)]/80 px-4 backdrop-blur-xl lg:px-8">
      {/* Left: greeting */}
      <div>
        <p className="text-sm text-[var(--text-secondary)]">
          {greeting},{' '}
          <span className="font-medium text-[var(--text-primary)]">
            {profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Bienvenue'}
          </span>{' '}
          👋
        </p>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-glow)] hover:bg-white/8 hover:text-[var(--text-primary)]"
          aria-label="Rechercher"
          data-testid="topbar-search"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Rechercher</span>
          <kbd className="hidden rounded bg-white/10 px-1.5 py-0.5 text-xs sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white/5 text-[var(--text-secondary)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
          aria-label="Notifications"
          data-testid="topbar-notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--cyan)]" />
        </button>

        {/* Avatar — mobile only */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--cyan)] to-[var(--purple)] text-sm font-semibold text-white lg:hidden"
          aria-label="Profil"
          data-testid="topbar-avatar"
        >
          {getInitials(profile?.full_name ?? profile?.email ?? null)}
        </div>
      </div>
    </header>
  )
}

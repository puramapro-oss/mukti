'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Sparkles, Users, Globe, Eye, Wind, Moon, HeartPulse,
  Wallet, Trophy, User, LogOut,
  ChevronLeft, ChevronRight, Share2, Shield, Bell, Settings,
  Megaphone, LifeBuoy,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { SUPER_ADMIN_EMAIL, APP_SHORT_NAME } from '@/lib/constants'

type NavItem = { href: string; icon: typeof Home; label: string; testId: string }

const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'Accueil', testId: 'nav-accueil' },
  { href: '/dashboard/liberation', icon: Sparkles, label: 'Libération', testId: 'nav-liberation' },
  { href: '/dashboard/cercles', icon: Users, label: 'Cercles', testId: 'nav-cercles' },
  { href: '/dashboard/core', icon: Globe, label: 'C.O.R.E.', testId: 'nav-core' },
]

const PRACTICE_NAV: NavItem[] = [
  { href: '/dashboard/aurora', icon: Wind, label: 'AURORA', testId: 'nav-aurora' },
  { href: '/dashboard/ar', icon: Eye, label: 'Energy Mirror', testId: 'nav-ar' },
  { href: '/dashboard/subconscient', icon: Moon, label: 'Reprogrammation', testId: 'nav-subconscient' },
  { href: '/dashboard/accompagnants', icon: HeartPulse, label: 'Accompagnants', testId: 'nav-accompagnants' },
]

const SECONDARY_NAV: NavItem[] = [
  { href: '/dashboard/wallet', icon: Wallet, label: 'Wallet', testId: 'nav-wallet' },
  { href: '/dashboard/missions', icon: Sparkles, label: 'Missions', testId: 'nav-missions' },
  { href: '/dashboard/concours', icon: Trophy, label: 'Concours', testId: 'nav-concours' },
  { href: '/dashboard/referral', icon: Share2, label: 'Parrainage', testId: 'nav-referral' },
  { href: '/dashboard/influenceur', icon: Megaphone, label: 'Ambassadeur', testId: 'nav-ambassadeur' },
  { href: '/dashboard/notifications', icon: Bell, label: 'Notifications', testId: 'nav-notifications' },
  { href: '/dashboard/profile', icon: User, label: 'Profil', testId: 'nav-profile' },
  { href: '/dashboard/settings', icon: Settings, label: 'Paramètres', testId: 'nav-settings' },
  { href: '/aide', icon: LifeBuoy, label: 'Aide', testId: 'nav-aide' },
]

const ADMIN_ITEM: NavItem = { href: '/dashboard/admin', icon: Shield, label: 'Admin', testId: 'nav-admin' }

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const isSuperAdmin = profile?.email === SUPER_ADMIN_EMAIL || profile?.role === 'super_admin'
  const navItems = isSuperAdmin
    ? [...PRIMARY_NAV, ...PRACTICE_NAV, ...SECONDARY_NAV, ADMIN_ITEM]
    : [...PRIMARY_NAV, ...PRACTICE_NAV, ...SECONDARY_NAV]

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl transition-all duration-300 lg:flex',
        collapsed ? 'w-16' : 'w-60'
      )}
      aria-label="Navigation principale"
    >
      <div className={cn('flex h-16 items-center border-b border-white/[0.06] px-4', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>🕉️</span>
            <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-white">
              {APP_SHORT_NAME}
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white transition-colors"
          aria-label={collapsed ? 'Déployer la navigation' : 'Réduire la navigation'}
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 scrollbar-thin">
        {navItems.map(({ href, icon: Icon, label, testId }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href + '/')) || (href === '/dashboard' && pathname === '/dashboard')
          return (
            <Link
              key={href}
              href={href}
              data-testid={testId}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                collapsed ? 'justify-center' : '',
                active
                  ? 'bg-violet-500/10 text-violet-200 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.2)]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className={cn('h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110', active && 'drop-shadow-[0_0_6px_rgba(124,58,237,0.6)]')} />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-3 space-y-2">
        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-xl p-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-sm font-semibold text-white">
              {getInitials(profile?.full_name ?? profile?.email ?? null)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {profile?.full_name ?? profile?.email ?? 'Bienvenue'}
              </p>
              <p className="text-xs text-white/40">
                Niveau {profile?.level ?? 1}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              aria-label="Déconnexion"
              data-testid="logout-sidebar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-sm font-semibold text-white">
              {getInitials(profile?.full_name ?? profile?.email ?? null)}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              aria-label="Déconnexion"
              data-testid="logout-sidebar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

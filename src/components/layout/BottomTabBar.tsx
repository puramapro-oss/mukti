'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Sparkles, Users, Wind, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard', icon: Home, label: 'Accueil' },
  { href: '/dashboard/liberation', icon: Sparkles, label: 'Libération' },
  { href: '/dashboard/cercles', icon: Users, label: 'Cercles' },
  { href: '/dashboard/aurora', icon: Wind, label: 'Souffle' },
  { href: '/dashboard/profile', icon: User, label: 'Profil' },
] as const

export default function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-white/[0.06] bg-[#0a0a0f]/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale mobile"
    >
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = href === '/dashboard' ? pathname === '/dashboard' : (pathname === href || pathname?.startsWith(href + '/'))
        return (
          <Link
            key={href}
            href={href}
            data-testid={`tab-${label.toLowerCase()}`}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-all duration-200',
              active ? 'text-violet-300' : 'text-white/60 hover:text-white'
            )}
          >
            <Icon className={cn(
              'h-5 w-5 transition-transform duration-200',
              active && 'drop-shadow-[0_0_6px_rgba(124,58,237,0.7)] scale-110'
            )} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

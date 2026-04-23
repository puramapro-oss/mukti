import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'cyan' | 'pink' | 'green' | 'gold' | 'purple' | 'orange'
  className?: string
}

const variantStyles = {
  default: 'bg-white/10 text-[var(--text-primary)]',
  cyan: 'bg-[var(--cyan)]/10 text-[var(--cyan)]',
  pink: 'bg-[var(--pink)]/10 text-[var(--pink)]',
  green: 'bg-[var(--green)]/10 text-[var(--green)]',
  gold: 'bg-[var(--gold)]/10 text-[var(--gold)]',
  purple: 'bg-[var(--purple)]/10 text-[var(--purple)]',
  orange: 'bg-[var(--orange)]/10 text-[var(--orange)]',
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', variantStyles[variant], className)}>
      {children}
    </span>
  )
}

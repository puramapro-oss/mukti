import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      {icon && <div className="text-4xl text-[var(--text-muted)]">{icon}</div>}
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-secondary)]">{title}</h3>
      {description && <p className="max-w-sm text-sm text-[var(--text-muted)]">{description}</p>}
      {action}
    </div>
  )
}

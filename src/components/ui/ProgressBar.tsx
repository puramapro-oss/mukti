import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  color?: string
  className?: string
}

export default function ProgressBar({ value, max = 100, label, color, className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">{label}</span>
          <span className="text-[var(--text-primary)] font-medium">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: color ?? 'linear-gradient(to right, var(--cyan), var(--purple))',
          }}
        />
      </div>
    </div>
  )
}

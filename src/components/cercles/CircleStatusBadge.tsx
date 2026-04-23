import type { CircleStatus } from '@/lib/circles'

const LABELS: Record<CircleStatus, { text: string; dot: string; bg: string; color: string }> = {
  open: { text: 'Ouvert', dot: '#06B6D4', bg: 'rgba(6,182,212,0.12)', color: '#67e8f9' },
  live: { text: 'En session', dot: '#10B981', bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },
  finished: { text: 'Terminé', dot: '#94a3b8', bg: 'rgba(148,163,184,0.12)', color: '#cbd5e1' },
  cancelled: { text: 'Annulé', dot: '#ef4444', bg: 'rgba(239,68,68,0.10)', color: '#fca5a5' },
}

export default function CircleStatusBadge({ status }: { status: CircleStatus }) {
  const cfg = LABELS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <span
        className={status === 'live' ? 'inline-block h-1.5 w-1.5 animate-pulse rounded-full' : 'inline-block h-1.5 w-1.5 rounded-full'}
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.text}
    </span>
  )
}

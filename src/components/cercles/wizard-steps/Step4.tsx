import { Calendar } from 'lucide-react'

interface Step4Props {
  startMode: 'now' | 'scheduled'
  scheduledAt: string
  onChangeStartMode: (m: 'now' | 'scheduled') => void
  onChangeScheduled: (v: string) => void
}

export default function Step4(props: Step4Props) {
  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 10)
  const minIso = minDate.toISOString().slice(0, 16)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Quand ouvrir le cercle ?</h2>
        <p className="mt-1 text-sm text-white/55">Maintenant ou à une heure précise.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => props.onChangeStartMode('now')}
          data-testid="start-now"
          className={`flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-all ${
            props.startMode === 'now'
              ? 'border-[var(--cyan)]/50 bg-[var(--cyan)]/10'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <span className="text-2xl">⚡</span>
          <p className="font-medium text-white">Maintenant</p>
          <p className="text-xs text-white/55">Le cercle s&apos;ouvre immédiatement. Il démarre auto dès que c&apos;est complet.</p>
        </button>
        <button
          type="button"
          onClick={() => props.onChangeStartMode('scheduled')}
          data-testid="start-scheduled"
          className={`flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-all ${
            props.startMode === 'scheduled'
              ? 'border-[var(--purple)]/50 bg-[var(--purple)]/10'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <span className="text-2xl">🕰️</span>
          <p className="font-medium text-white">Programmer</p>
          <p className="text-xs text-white/55">Date et heure précises. Les participants reçoivent un rappel 10 minutes avant.</p>
        </button>
      </div>

      {props.startMode === 'scheduled' && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60" htmlFor="scheduled-at">
            <Calendar className="h-3.5 w-3.5" /> Date et heure
          </label>
          <input
            id="scheduled-at"
            type="datetime-local"
            min={minIso}
            value={props.scheduledAt}
            onChange={(e) => props.onChangeScheduled(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white focus:border-[var(--purple)]/60 focus:outline-none"
            data-testid="scheduled-input"
          />
          <p className="text-[11px] text-white/40">
            Fuseau local : {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
      )}
    </div>
  )
}

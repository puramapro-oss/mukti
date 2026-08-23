import { CIRCLE_CATEGORIES, type CircleCategoryId } from '@/lib/constants'

interface Step1Props {
  selected: CircleCategoryId | null
  onSelect: (id: CircleCategoryId) => void
}

export default function Step1({ selected, onSelect }: Step1Props) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Quelle intention veux-tu rayonner ?</h2>
        <p className="mt-1 text-sm text-white/55">Le cœur du cercle — choisis la fréquence.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {CIRCLE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            data-testid={`wizard-cat-${c.id}`}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
              selected === c.id
                ? 'border-white/30 bg-white/[0.08]'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
            }`}
            style={selected === c.id ? { boxShadow: `0 0 0 1px ${c.color}80` } : undefined}
          >
            <span className="text-2xl" aria-hidden>{c.emoji}</span>
            <span className="text-[11px] font-medium text-white/85">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

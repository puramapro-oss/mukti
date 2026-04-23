import Link from 'next/link'
import { CIRCLE_CATEGORIES, type CircleCategoryId } from '@/lib/constants'

interface CircleCategoryGridProps {
  counts: Record<string, { open: number; live: number }>
}

export default function CircleCategoryGrid({ counts }: CircleCategoryGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {CIRCLE_CATEGORIES.map((cat) => {
        const c = counts[cat.id] ?? { open: 0, live: 0 }
        const total = c.open + c.live
        return (
          <Link
            key={cat.id}
            href={`/dashboard/cercles/${cat.id}`}
            data-testid={`cat-${cat.id}`}
            className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center transition-all hover:border-white/20 hover:bg-white/[0.05]"
            style={{
              boxShadow: `inset 0 0 0 1px ${hexAlpha(cat.color, 0.08)}`,
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: `radial-gradient(ellipse at top, ${hexAlpha(cat.color, 0.18)} 0%, transparent 70%)`,
              }}
              aria-hidden
            />
            <span className="relative text-3xl leading-none" aria-hidden>
              {cat.emoji}
            </span>
            <div className="relative">
              <h3 className="text-sm font-medium text-white/90">{cat.name}</h3>
              <p className="mt-1 text-[11px] text-white/45">
                {total === 0 ? 'Aucun cercle' : `${total} cercle${total > 1 ? 's' : ''}`}
              </p>
              {c.live > 0 && (
                <span
                  className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: hexAlpha(cat.color, 0.15),
                    color: cat.color,
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {c.live} en session
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export type { CircleCategoryId }

import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'
import { CORE_FORMATS, type CoreFormat } from '@/lib/constants'

interface Props {
  id: string
  format: CoreFormat
  title: string
  intention: string
  region?: string | null
  severity: number
  momentZ: Date
  participantsCount: number
  status: 'scheduled' | 'live' | 'finished' | 'draft' | 'rejected'
}

export default function COREEventCard(props: Props) {
  const fmt = CORE_FORMATS.find(f => f.id === props.format) ?? CORE_FORMATS[0]!
  const intentionWord = props.intention.trim().split(/\s+/)[0]?.toUpperCase() ?? props.intention

  const now = Date.now()
  const diffMin = Math.round((props.momentZ.getTime() - now) / 60000)
  const relative =
    props.status === 'finished'
      ? 'Terminé'
      : props.status === 'live'
        ? '● En direct'
        : diffMin <= 0
          ? 'Imminent'
          : diffMin < 60
            ? `Dans ${diffMin} min`
            : diffMin < 1440
              ? `Dans ${Math.round(diffMin / 60)} h`
              : `Dans ${Math.round(diffMin / 1440)} j`

  return (
    <Link
      href={`/dashboard/core/${props.id}`}
      data-testid={`core-event-card-${props.id}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.06]"
      style={{
        background: `linear-gradient(135deg, ${fmt.color}18 0%, transparent 55%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/55">
          <span className="text-xl">{fmt.emoji}</span>
          <span>{fmt.name}</span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
            props.status === 'live'
              ? 'border-rose-400/40 bg-rose-500/10 text-rose-200'
              : props.status === 'finished'
                ? 'border-white/15 bg-white/5 text-white/55'
                : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {relative}
        </span>
      </div>
      <h3 className="line-clamp-2 text-lg font-medium text-white">{props.title}</h3>
      <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-widest text-white/70">
        <span className="rounded-full border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2 py-0.5 text-[#DDD6FE]">
          {intentionWord}
        </span>
        {props.region && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            {props.region}
          </span>
        )}
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
          Gravité {props.severity}/5
        </span>
      </div>
      <div className="mt-auto flex items-center justify-between text-xs text-white/65">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {props.participantsCount}
        </span>
        <span className="inline-flex items-center gap-1 text-white/80 transition-colors group-hover:text-white">
          Ouvrir
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}

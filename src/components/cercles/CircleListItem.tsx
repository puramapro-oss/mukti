'use client'

import Link from 'next/link'
import { Clock, Users, Radio } from 'lucide-react'
import { CIRCLE_CATEGORIES, CIRCLE_GUIDANCE_MODES } from '@/lib/constants'
import type { Circle } from '@/lib/circles'
import CircleStatusBadge from './CircleStatusBadge'

interface CircleListItemProps {
  circle: Circle & { participant_count: number }
}

export default function CircleListItem({ circle }: CircleListItemProps) {
  const cat = CIRCLE_CATEGORIES.find((c) => c.id === circle.category)
  const guidance = CIRCLE_GUIDANCE_MODES.find((g) => g.id === circle.guidance_mode)
  const minutes = Math.round(circle.duration_per_person_sec / 60)
  const full = circle.participant_count >= circle.max_participants
  const canJoin = !full && (circle.status === 'open' || circle.status === 'live')

  return (
    <article
      className="group flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04]"
      data-testid={`circle-item-${circle.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ backgroundColor: hexAlpha(cat?.color ?? '#7C3AED', 0.12) }}
            aria-hidden
          >
            {cat?.emoji ?? '🌌'}
          </span>
          <div>
            <h3 className="text-base font-medium leading-tight text-white line-clamp-1">
              {circle.title}
            </h3>
            <p className="mt-0.5 text-xs text-white/50">{cat?.name ?? circle.category}</p>
          </div>
        </div>
        <CircleStatusBadge status={circle.status} />
      </div>

      {circle.description && (
        <p className="text-sm leading-relaxed text-white/60 line-clamp-2">{circle.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {circle.participant_count}/{circle.max_participants}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {minutes} min / personne
        </span>
        {guidance && (
          <span className="inline-flex items-center gap-1.5" title={guidance.desc}>
            <Radio className="h-3.5 w-3.5" />
            {guidance.name}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-xs text-white/40">
          {circle.audio_mode === 'sfu' ? 'Audio grand groupe' : 'Audio direct'}
        </span>
        {canJoin ? (
          <Link
            href={`/dashboard/cercles/room/${circle.id}`}
            data-testid={`join-${circle.id}`}
            className="rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            {circle.status === 'live' ? 'Rejoindre la session' : 'Entrer dans le cercle'}
          </Link>
        ) : full ? (
          <span className="rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-white/40">Complet</span>
        ) : (
          <span className="rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-white/40">Fermé</span>
        )}
      </div>
    </article>
  )
}

function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

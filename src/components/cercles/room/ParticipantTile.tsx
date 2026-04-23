'use client'

import { Mic, MicOff, User } from 'lucide-react'
import { getInitials } from '@/lib/utils'

export interface ParticipantTileData {
  userId: string
  name: string | null
  micMuted: boolean
  speaking: boolean
  isMe: boolean
  isFocused: boolean
}

interface ParticipantTileProps {
  data: ParticipantTileData
  size?: 'sm' | 'md' | 'lg'
}

export default function ParticipantTile({ data, size = 'md' }: ParticipantTileProps) {
  const sizeMap = {
    sm: { tile: 'h-20', avatar: 'h-10 w-10 text-xs', label: 'text-[11px]' },
    md: { tile: 'h-28', avatar: 'h-14 w-14 text-sm', label: 'text-xs' },
    lg: { tile: 'h-40 sm:h-44', avatar: 'h-20 w-20 sm:h-24 sm:w-24 text-lg', label: 'text-sm' },
  }
  const s = sizeMap[size]

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border bg-black/30 ${s.tile} transition-all`}
      style={{
        borderColor: data.isFocused ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.06)',
        boxShadow: data.isFocused
          ? '0 0 0 1px rgba(124,58,237,0.4), 0 0 40px rgba(124,58,237,0.25)'
          : undefined,
      }}
      data-testid={`tile-${data.userId}`}
    >
      {data.isFocused && (
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: 'radial-gradient(circle at center, rgba(124,58,237,0.18) 0%, transparent 70%)',
          }}
          aria-hidden
        />
      )}
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${s.avatar}`}
        style={{
          background: data.speaking
            ? 'linear-gradient(135deg, #06B6D4, #7C3AED)'
            : 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(6,182,212,0.5))',
        }}
      >
        {data.speaking && (
          <span
            className="absolute inset-0 rounded-full border-2 border-[var(--cyan)] opacity-60 animate-ping"
            aria-hidden
          />
        )}
        {data.name ? getInitials(data.name) : <User className="h-1/2 w-1/2" />}
      </div>
      <div className="flex items-center gap-1.5 text-center">
        <span className={`font-medium text-white/85 ${s.label}`}>
          {data.name ? shortName(data.name) : 'Âme'}
          {data.isMe && <span className="ml-1 text-white/40">(toi)</span>}
        </span>
        {data.micMuted ? (
          <MicOff className="h-3.5 w-3.5 text-red-400" aria-label="Micro coupé" />
        ) : (
          <Mic className="h-3.5 w-3.5 text-white/40" aria-label="Micro actif" />
        )}
      </div>
    </div>
  )
}

function shortName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 16) return trimmed
  return trimmed.split(' ')[0]?.slice(0, 16) ?? trimmed.slice(0, 16)
}

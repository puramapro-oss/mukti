'use client'

// MUKTI — G5.2 AURORA Canvas wrapper
// Dynamic import ssr:false (WebGL browser-only).
// Utilisé par les pages /dashboard/aurora et /dashboard/aurora/[variant].

import dynamic from 'next/dynamic'
import type { AuroraCanvasInnerProps } from './AuroraCanvasInner'

const AuroraCanvasInner = dynamic(() => import('./AuroraCanvasInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[400px] w-full items-center justify-center bg-[#05050a] text-white/60">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-gradient-to-br from-[#7C3AED] via-[#06B6D4] to-[#F472B6]" />
        <p className="text-xs uppercase tracking-[0.25em]">Chargement AURORA…</p>
      </div>
    </div>
  ),
})

export type { AuroraCanvasInnerProps as AuroraCanvasProps }

export default function AuroraCanvas(props: AuroraCanvasInnerProps) {
  return <AuroraCanvasInner {...props} />
}

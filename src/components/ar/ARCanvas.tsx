'use client'

// MUKTI — G4 AR Engine
// Wrapper public : dynamic import de ARCanvasInner (ssr:false obligatoire — WebGL + MediaPipe).

import dynamic from 'next/dynamic'
import type { ARCanvasInnerProps } from './ARCanvasInner'

const ARCanvasInner = dynamic(() => import('./ARCanvasInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black text-white/60">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-gradient-to-br from-[var(--purple,#7C3AED)] to-[var(--cyan,#06B6D4)]" />
        <p className="text-xs uppercase tracking-widest">Préparation du miroir…</p>
      </div>
    </div>
  ),
})

export type { ARCanvasInnerProps as ARCanvasProps }

export default function ARCanvas(props: ARCanvasInnerProps) {
  return <ARCanvasInner {...props} />
}

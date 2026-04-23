'use client'

// MUKTI — G4 AR Engine
// Context partagé : expose latestFrameRef aux composants r3f enfants du Canvas.
// React contexts externes propagent dans le tree r3f (confirmé R3F v9).

import { createContext, useContext, type MutableRefObject, type ReactNode } from 'react'
import type { TrackerFrameResult } from './types'

type FrameRef = MutableRefObject<TrackerFrameResult | null>

// Fallback ref — partagé statiquement, toujours null. Permet à useLatestFrame()
// de ne pas crasher si utilisé hors provider (Storybook, tests).
const FALLBACK_REF: FrameRef = { current: null }

const FrameContext = createContext<FrameRef>(FALLBACK_REF)

export function FrameProvider({
  frameRef,
  children,
}: {
  frameRef: FrameRef
  children: ReactNode
}) {
  return <FrameContext.Provider value={frameRef}>{children}</FrameContext.Provider>
}

export function useLatestFrame(): FrameRef {
  return useContext(FrameContext)
}

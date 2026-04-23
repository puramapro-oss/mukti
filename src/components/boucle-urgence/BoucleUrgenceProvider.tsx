'use client'

// MUKTI — G5.7 BoucleUrgenceProvider
// Context global : expose openBoucle(trigger, durationSec) + listener double-press "B" (<500ms).
// Ignore input/textarea/contenteditable. Fournit overlay state.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  BOUCLE_URGENCE_DEFAULT_DURATION_SEC,
  type BoucleUrgenceTrigger,
} from '@/lib/boucle-urgence-utils'

interface BoucleUrgenceContextValue {
  isOpen: boolean
  triggerSource: BoucleUrgenceTrigger | null
  targetDurationSec: number
  openBoucle: (trigger: BoucleUrgenceTrigger, durationSec?: number) => void
  closeBoucle: () => void
}

const BoucleUrgenceContext = createContext<BoucleUrgenceContextValue | null>(null)

const DOUBLE_PRESS_WINDOW_MS = 500

export function BoucleUrgenceProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [triggerSource, setTriggerSource] = useState<BoucleUrgenceTrigger | null>(null)
  const [targetDurationSec, setTargetDurationSec] = useState<number>(
    BOUCLE_URGENCE_DEFAULT_DURATION_SEC
  )
  const lastKeyTimeRef = useRef<number>(0)

  const openBoucle = useCallback(
    (trigger: BoucleUrgenceTrigger, durationSec?: number) => {
      setTriggerSource(trigger)
      setTargetDurationSec(durationSec ?? BOUCLE_URGENCE_DEFAULT_DURATION_SEC)
      setIsOpen(true)
    },
    []
  )

  const closeBoucle = useCallback(() => {
    setIsOpen(false)
    setTriggerSource(null)
  }, [])

  // Listener global : double-press "B" (ignore si focus input/contenteditable)
  useEffect(() => {
    function isEditableTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (t.isContentEditable) return true
      return false
    }

    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) return
      if (e.key !== 'b' && e.key !== 'B') return
      if (isEditableTarget(e.target)) return
      if (isOpen) return

      const now = Date.now()
      const delta = now - lastKeyTimeRef.current
      if (delta > 0 && delta < DOUBLE_PRESS_WINDOW_MS) {
        e.preventDefault()
        lastKeyTimeRef.current = 0
        openBoucle('shortcut')
      } else {
        lastKeyTimeRef.current = now
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, openBoucle])

  const value = useMemo(
    () => ({ isOpen, triggerSource, targetDurationSec, openBoucle, closeBoucle }),
    [isOpen, triggerSource, targetDurationSec, openBoucle, closeBoucle]
  )

  return (
    <BoucleUrgenceContext.Provider value={value}>{children}</BoucleUrgenceContext.Provider>
  )
}

export function useBoucleUrgence(): BoucleUrgenceContextValue {
  const ctx = useContext(BoucleUrgenceContext)
  if (!ctx) {
    throw new Error('useBoucleUrgence doit être utilisé dans un BoucleUrgenceProvider.')
  }
  return ctx
}

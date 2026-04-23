'use client'

// MUKTI — G5.6 Rituel7sProvider
// Context global : expose openRituel(trigger) + listener double-press "R" (<500ms).
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
import type { Rituel7sTrigger } from '@/lib/rituel-7s-utils'

interface Rituel7sContextValue {
  isOpen: boolean
  triggerSource: Rituel7sTrigger | null
  openRituel: (trigger: Rituel7sTrigger) => void
  closeRituel: () => void
}

const Rituel7sContext = createContext<Rituel7sContextValue | null>(null)

const DOUBLE_PRESS_WINDOW_MS = 500

export function Rituel7sProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [triggerSource, setTriggerSource] = useState<Rituel7sTrigger | null>(null)
  const lastKeyTimeRef = useRef<number>(0)

  const openRituel = useCallback((trigger: Rituel7sTrigger) => {
    setTriggerSource(trigger)
    setIsOpen(true)
  }, [])

  const closeRituel = useCallback(() => {
    setIsOpen(false)
    setTriggerSource(null)
  }, [])

  // Listener global : double-press "R" (ignore si focus input/contenteditable)
  useEffect(() => {
    function isEditableTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (t.isContentEditable) return true
      return false
    }

    function onKey(e: KeyboardEvent) {
      // Ignore si modifier lourd sauf Alt (Alt+R = accès explicite)
      if (e.ctrlKey || e.metaKey) return
      if (e.key !== 'r' && e.key !== 'R') return
      if (isEditableTarget(e.target)) return
      if (isOpen) return

      const now = Date.now()
      const delta = now - lastKeyTimeRef.current
      if (delta > 0 && delta < DOUBLE_PRESS_WINDOW_MS) {
        e.preventDefault()
        lastKeyTimeRef.current = 0
        openRituel('shortcut')
      } else {
        lastKeyTimeRef.current = now
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, openRituel])

  const value = useMemo(
    () => ({ isOpen, triggerSource, openRituel, closeRituel }),
    [isOpen, triggerSource, openRituel, closeRituel]
  )

  return <Rituel7sContext.Provider value={value}>{children}</Rituel7sContext.Provider>
}

export function useRituel7s(): Rituel7sContextValue {
  const ctx = useContext(Rituel7sContext)
  if (!ctx) {
    throw new Error('useRituel7s doit être utilisé dans un Rituel7sProvider.')
  }
  return ctx
}

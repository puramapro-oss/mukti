'use client'

// MUKTI G8.7.6 — Hook préférences a11y (live sync via custom event)

import { useEffect, useState, useCallback } from 'react'
import { loadA11yPrefs, saveA11yPrefs, type AccessibilityPrefs } from '@/lib/accessibility'

export function useAccessibilityPrefs(): {
  prefs: AccessibilityPrefs
  setPrefs: (patch: Partial<AccessibilityPrefs>) => void
} {
  const [prefs, setPrefsState] = useState<AccessibilityPrefs>(() => loadA11yPrefs())

  useEffect(() => {
    setPrefsState(loadA11yPrefs())
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<AccessibilityPrefs>
      if (ce.detail) setPrefsState(ce.detail)
    }
    window.addEventListener('mukti:a11y-prefs-change', onChange)
    return () => window.removeEventListener('mukti:a11y-prefs-change', onChange)
  }, [])

  const setPrefs = useCallback((patch: Partial<AccessibilityPrefs>) => {
    const next = saveA11yPrefs(patch)
    setPrefsState(next)
  }, [])

  return { prefs, setPrefs }
}

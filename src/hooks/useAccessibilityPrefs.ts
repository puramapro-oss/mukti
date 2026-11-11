'use client'
import { useEffect, useState, useCallback } from 'react'
import { DEFAULT_A11Y_PREFS, loadA11yPrefs, saveA11yPrefsWithStatus, subscribeA11yPrefs, type AccessibilityPrefs } from '@/lib/accessibility'

export function useAccessibilityPrefs(): {
  prefs: AccessibilityPrefs
  setPrefs: (patch: Partial<AccessibilityPrefs>) => boolean
} {
  // The first browser render matches the server; preferences load after mount.
  const [prefs, setPrefsState] = useState<AccessibilityPrefs>(() => ({ ...DEFAULT_A11Y_PREFS }))
  useEffect(() => {
    let active = true
    const refresh = () => { if (active) setPrefsState(loadA11yPrefs()) }
    const unsubscribe = subscribeA11yPrefs(refresh)
    queueMicrotask(refresh)
    return () => { active = false; unsubscribe() }
  }, [])
  const setPrefs = useCallback((patch: Partial<AccessibilityPrefs>) => {
    const result = saveA11yPrefsWithStatus(patch)
    setPrefsState(result.prefs)
    return result.persisted
  }, [])
  return { prefs, setPrefs }
}

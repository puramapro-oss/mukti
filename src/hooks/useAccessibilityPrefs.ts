'use client'
import { useEffect, useState, useCallback } from 'react'
import { DEFAULT_A11Y_PREFS, loadA11yPrefsSnapshot, saveA11yPrefsWithStatus, subscribeA11yPrefs, type AccessibilityPrefs, type AccessibilityPrefsSnapshot } from '@/lib/accessibility'

type PrefsState = {
  prefs: AccessibilityPrefs
  persistence: AccessibilityPrefsSnapshot['persistence'] | 'saved'
}

export function useAccessibilityPrefs(): {
  prefs: AccessibilityPrefs
  persistence: PrefsState['persistence']
  setPrefs: (patch: Partial<AccessibilityPrefs>) => boolean
} {
  // The first browser render matches the server; preferences load after mount.
  const [state, setPrefsState] = useState<PrefsState>(() => ({ prefs: { ...DEFAULT_A11Y_PREFS }, persistence: 'pending' }))
  useEffect(() => {
    let active = true
    const refresh = () => { if (active) setPrefsState(loadA11yPrefsSnapshot()) }
    const unsubscribe = subscribeA11yPrefs(refresh)
    queueMicrotask(refresh)
    return () => { active = false; unsubscribe() }
  }, [])
  const setPrefs = useCallback((patch: Partial<AccessibilityPrefs>) => {
    const result = saveA11yPrefsWithStatus(patch)
    // Only this explicit successful write earns a saved confirmation. A later
    // refresh, including storage recovery, reports the current snapshot instead.
    setPrefsState(result.persisted ? { prefs: result.prefs, persistence: 'saved' } : loadA11yPrefsSnapshot())
    return result.persisted
  }, [])
  return { ...state, setPrefs }
}

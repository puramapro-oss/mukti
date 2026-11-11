'use client'

import { useEffect } from 'react'
import { useAccessibilityPrefs } from '@/hooks/useAccessibilityPrefs'

/** Applies the existing preferences once for every route in this document. */
export default function AccessibilityPreferencesRoot() {
  const { prefs } = useAccessibilityPrefs()
  useEffect(() => {
    const root = document.documentElement
    root.dataset.muktiTextSize = prefs.fontSize
    root.dataset.muktiContrast = String(prefs.highContrast)
    root.dataset.muktiReducedMotion = String(prefs.reducedMotionForced)
    return () => {
      delete root.dataset.muktiTextSize
      delete root.dataset.muktiContrast
      delete root.dataset.muktiReducedMotion
    }
  }, [prefs.fontSize, prefs.highContrast, prefs.reducedMotionForced])
  return null
}

// MUKTI G8.7.6 — Préférences a11y centralisées (localStorage)
// Mode silencieux global, haptique, captions, contrast, taille texte

export type FontSizePref = 'sm' | 'md' | 'lg' | 'xl'

export interface AccessibilityPrefs {
  silentMode: boolean
  hapticEnabled: boolean
  captionsForced: boolean
  reducedMotionForced: boolean
  highContrast: boolean
  fontSize: FontSizePref
}

export const DEFAULT_A11Y_PREFS: AccessibilityPrefs = {
  silentMode: false,
  hapticEnabled: true,
  captionsForced: false,
  reducedMotionForced: false,
  highContrast: false,
  fontSize: 'md',
}

const STORAGE_KEY = 'mukti.a11y.prefs'

export function loadA11yPrefs(): AccessibilityPrefs {
  if (typeof window === 'undefined') return DEFAULT_A11Y_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_A11Y_PREFS
    const parsed = JSON.parse(raw) as Partial<AccessibilityPrefs>
    return { ...DEFAULT_A11Y_PREFS, ...parsed }
  } catch {
    return DEFAULT_A11Y_PREFS
  }
}

export function saveA11yPrefs(prefs: Partial<AccessibilityPrefs>): AccessibilityPrefs {
  if (typeof window === 'undefined') return DEFAULT_A11Y_PREFS
  const current = loadA11yPrefs()
  const merged = { ...current, ...prefs }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    window.dispatchEvent(new CustomEvent('mukti:a11y-prefs-change', { detail: merged }))
  } catch {
    // ignore quota errors
  }
  return merged
}

/**
 * Vibration safe : respecte mode silencieux + hapticEnabled + Vibration API support.
 * Patterns standard : SHORT_PULSE, MEDIUM_PULSE, LONG_PULSE, BREATH_INSPIRE, BREATH_HOLD, BREATH_EXPIRE.
 */
export function safeVibrate(pattern: number | readonly number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  const prefs = loadA11yPrefs()
  if (prefs.silentMode || !prefs.hapticEnabled) return false
  try {
    const arg = typeof pattern === 'number' ? pattern : Array.from(pattern)
    return navigator.vibrate(arg)
  } catch {
    return false
  }
}

export const VIBRATE_PATTERNS = {
  SHORT: 50,
  MEDIUM: 150,
  LONG: 400,
  BREATH_INSPIRE: [200, 100, 200],
  BREATH_HOLD: [500],
  BREATH_EXPIRE: [200, 100, 200, 100, 200],
  CORE_START: [1000, 200, 1000],
  RITUEL_TICK: 80,
  SUCCESS: [100, 50, 100, 50, 200],
  WARNING: [300],
} as const

export function fontSizeClass(pref: FontSizePref): string {
  switch (pref) {
    case 'sm': return 'text-[14px]'
    case 'lg': return 'text-[18px]'
    case 'xl': return 'text-[22px]'
    default: return ''
  }
}

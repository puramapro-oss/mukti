// Existing MUKTI preference contract and storage key are retained.
export type FontSizePref = 'sm' | 'md' | 'lg' | 'xl'
export interface AccessibilityPrefs {
  silentMode: boolean
  hapticEnabled: boolean
  captionsForced: boolean
  reducedMotionForced: boolean
  highContrast: boolean
  fontSize: FontSizePref
}
export const DEFAULT_A11Y_PREFS: Readonly<AccessibilityPrefs> = Object.freeze({
  silentMode: false, hapticEnabled: true, captionsForced: false,
  reducedMotionForced: false, highContrast: false, fontSize: 'md',
})
export const A11Y_STORAGE_KEY = 'mukti.a11y.prefs'
export const A11Y_PREFS_EVENT = 'mukti:a11y-prefs-change'
const BOOLEAN_KEYS = ['silentMode', 'hapticEnabled', 'captionsForced', 'reducedMotionForced', 'highContrast'] as const
const FONT_SIZES: readonly FontSizePref[] = ['sm', 'md', 'lg', 'xl']
// An unavailable localStorage must not prevent changing this tab's interface.
let sessionPrefs: AccessibilityPrefs | null = null

export function normalizeA11yPrefs(value: unknown): AccessibilityPrefs {
  const result = { ...DEFAULT_A11Y_PREFS }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result
  const input = value as Record<string, unknown>
  for (const key of BOOLEAN_KEYS) {
    if (Object.hasOwn(input, key) && typeof input[key] === 'boolean') result[key] = input[key]
  }
  if (Object.hasOwn(input, 'fontSize') && FONT_SIZES.includes(input.fontSize as FontSizePref)) result.fontSize = input.fontSize as FontSizePref
  return result
}

export function loadA11yPrefs(): AccessibilityPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_A11Y_PREFS }
  if (sessionPrefs) return { ...sessionPrefs }
  try {
    const raw = window.localStorage.getItem(A11Y_STORAGE_KEY)
    if (!raw || raw.length > 4096) return { ...DEFAULT_A11Y_PREFS }
    return normalizeA11yPrefs(JSON.parse(raw))
  } catch { return { ...DEFAULT_A11Y_PREFS } }
}

export function saveA11yPrefsWithStatus(patch: Partial<AccessibilityPrefs>): { prefs: AccessibilityPrefs; persisted: boolean } {
  if (typeof window === 'undefined') return { prefs: { ...DEFAULT_A11Y_PREFS }, persisted: false }
  const next = { ...loadA11yPrefs() }
  // A bad patch must not reset other valid preferences to their defaults.
  if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
    for (const key of BOOLEAN_KEYS) {
      if (Object.hasOwn(patch, key) && typeof patch[key] === 'boolean') next[key] = patch[key]
    }
    if (Object.hasOwn(patch, 'fontSize') && FONT_SIZES.includes(patch.fontSize as FontSizePref)) next.fontSize = patch.fontSize as FontSizePref
  }
  let persisted = false
  try {
    window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next))
    persisted = true
    sessionPrefs = null
  } catch { sessionPrefs = next }
  // Stop an already-running vibration when the user disables it.
  if ((next.silentMode || !next.hapticEnabled) && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(0) } catch { /* Hardware feedback remains optional. */ }
  }
  window.dispatchEvent(new CustomEvent(A11Y_PREFS_EVENT, { detail: { ...next } }))
  return { prefs: { ...next }, persisted }
}

// Preserve the original return type for existing callers.
export function saveA11yPrefs(patch: Partial<AccessibilityPrefs>): AccessibilityPrefs {
  return saveA11yPrefsWithStatus(patch).prefs
}

export function subscribeA11yPrefs(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onLocal = () => listener()
  const onStorage = (event: StorageEvent) => {
    try {
      if (event.storageArea !== window.localStorage || (event.key !== A11Y_STORAGE_KEY && event.key !== null)) return
      sessionPrefs = null
      listener()
    } catch { /* A blocked storage area cannot supply a new preference. */ }
  }
  // Ignore event payloads; reload and validate the actual source.
  window.addEventListener(A11Y_PREFS_EVENT, onLocal)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(A11Y_PREFS_EVENT, onLocal)
    window.removeEventListener('storage', onStorage)
  }
}

export function safeVibrate(pattern: number | readonly number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  const prefs = loadA11yPrefs()
  if (prefs.silentMode || !prefs.hapticEnabled) return false
  const values = typeof pattern === 'number' ? [pattern] : Array.from(pattern)
  if (values.length > 64 || values.some(value => !Number.isFinite(value) || value < 0 || value > 10000)) return false
  try { return navigator.vibrate(typeof pattern === 'number' ? pattern : values) } catch { return false }
}
export const VIBRATE_PATTERNS = {
  SHORT: 50, MEDIUM: 150, LONG: 400,
  BREATH_INSPIRE: [200, 100, 200], BREATH_HOLD: [500], BREATH_EXPIRE: [200, 100, 200, 100, 200],
  CORE_START: [1000, 200, 1000], RITUEL_TICK: 80,
  SUCCESS: [100, 50, 100, 50, 200], WARNING: [300],
} as const
export function fontSizeClass(pref: FontSizePref): string {
  switch (pref) {
    case 'sm': return 'text-[14px]'
    case 'lg': return 'text-[18px]'
    case 'xl': return 'text-[22px]'
    default: return ''
  }
}

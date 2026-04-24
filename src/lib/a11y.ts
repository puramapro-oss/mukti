// MUKTI G8.1 — a11y helpers (contrast check + reduced-motion)

export interface RgbColor { r: number; g: number; b: number }

export function hexToRgb(hex: string): RgbColor | null {
  const cleaned = hex.replace(/^#/, '')
  const full = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned
  if (full.length !== 6) return null
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return { r, g, b }
}

function channelToLinear(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(c: RgbColor): number {
  return 0.2126 * channelToLinear(c.r) + 0.7152 * channelToLinear(c.g) + 0.0722 * channelToLinear(c.b)
}

export function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return 1
  const la = relativeLuminance(ra)
  const lb = relativeLuminance(rb)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

export type WcagLevel = 'AA' | 'AAA'

export function meetsContrast(fg: string, bg: string, level: WcagLevel = 'AA', isLargeText = false): boolean {
  const ratio = contrastRatio(fg, bg)
  const threshold = level === 'AAA'
    ? (isLargeText ? 4.5 : 7)
    : (isLargeText ? 3 : 4.5)
  return ratio >= threshold
}

// Client-side prefers-reduced-motion detection
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Client-side prefers-contrast: more
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-contrast: more)').matches
  } catch {
    return false
  }
}

// ARIA helper: screen-reader-only class
export const SR_ONLY_CLASS = 'sr-only'

// Skip-to-content target id
export const MAIN_CONTENT_ID = 'main-content'

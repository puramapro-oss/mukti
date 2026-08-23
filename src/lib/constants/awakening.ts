// MUKTI — Awakening Levels
export const AWAKENING_LEVELS = [
  { id: 1, name: 'Éveillé·e', min: 0, max: 99, emoji: '👁️', color: '#a78bfa' },
  { id: 2, name: 'Chercheur·euse', min: 100, max: 499, emoji: '🌱', color: '#7c3aed' },
  { id: 3, name: 'Libéré·e', min: 500, max: 1999, emoji: '🕊️', color: '#06b6d4' },
  { id: 4, name: 'Sage', min: 2000, max: 9999, emoji: '🪷', color: '#10b981' },
  { id: 5, name: 'Lumière', min: 10000, max: Number.MAX_SAFE_INTEGER, emoji: '✨', color: '#F59E0B' },
] as const

// Alias for compat with existing template code referring LEVELS
export const LEVELS = AWAKENING_LEVELS

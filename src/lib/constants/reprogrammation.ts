// MUKTI — Reprogrammation subconscient
// 9 catégories (match CHECK SQL affirmations)
export const REPROG_CATEGORIES = [
  { id: 'abondance',             name: 'Abondance',             emoji: '💫', color: '#F59E0B', solfeggio_hz: 639 },
  { id: 'amour-soi',             name: 'Amour de soi',          emoji: '❤️', color: '#ec4899', solfeggio_hz: 528 },
  { id: 'confiance',             name: 'Confiance',             emoji: '🦁', color: '#7c3aed', solfeggio_hz: 417 },
  { id: 'liberation-addictions', name: 'Libération addictions', emoji: '🔓', color: '#06b6d4', solfeggio_hz: 396 },
  { id: 'guerison-emotionnelle', name: 'Guérison émotionnelle', emoji: '🌿', color: '#10b981', solfeggio_hz: 528 },
  { id: 'sommeil-reparateur',    name: 'Sommeil réparateur',    emoji: '🌙', color: '#1e1b4b', solfeggio_hz: 174 },
  { id: 'manifestation',         name: 'Manifestation',         emoji: '🌠', color: '#a855f7', solfeggio_hz: 852 },
  { id: 'protection',            name: 'Protection',            emoji: '🧿', color: '#6366f1', solfeggio_hz: 741 },
  { id: 'paix',                  name: 'Paix',                  emoji: '🕊️', color: '#0ea5e9', solfeggio_hz: 432 },
] as const
export type ReprogCategory = typeof REPROG_CATEGORIES[number]['id']

// Sons nature — Mode Nuit + Mode Journée (Web Audio synthèse procédurale ou loops futurs)
export const NATURE_SOUNDS = [
  { id: 'foret',   name: 'Forêt',   emoji: '🌲', description_fr: 'Feuillage, oiseaux lointains' },
  { id: 'riviere', name: 'Rivière', emoji: '🏞️', description_fr: 'Eau vive, galets' },
  { id: 'vent',    name: 'Vent',    emoji: '🍃', description_fr: 'Brise douce' },
  { id: 'pluie',   name: 'Pluie',   emoji: '🌧️', description_fr: 'Pluie douce régulière' },
  { id: 'ocean',   name: 'Océan',   emoji: '🌊', description_fr: 'Vagues lentes et profondes' },
  { id: 'silence', name: 'Silence', emoji: '🤍', description_fr: 'Voix uniquement' },
] as const
export type NatureSound = typeof NATURE_SOUNDS[number]['id']

// Mode Journée : notifs toutes les 2h entre 9h-20h (6 slots max/jour)
export const REPROG_DAY_REMINDER_HOURS = [9, 11, 13, 15, 17, 19] as const
// Mode Nuit : timer ramp down — volume descend linéairement en 30 min
export const REPROG_NIGHT_VOLUME_RAMP_MIN = 30

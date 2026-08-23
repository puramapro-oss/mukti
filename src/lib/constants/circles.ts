// MUKTI — Circles d'Intention
// 14 catégories Cercles d'Intention (P3)
export const CIRCLE_CATEGORIES = [
  { id: 'abondance', name: 'Abondance', emoji: '🌟', color: '#F59E0B' },
  { id: 'amour_soi', name: 'Amour de soi', emoji: '❤️', color: '#ec4899' },
  { id: 'apaisement', name: 'Apaisement', emoji: '🌊', color: '#06b6d4' },
  { id: 'motivation', name: 'Motivation', emoji: '🔥', color: '#ef4444' },
  { id: 'renouveau', name: 'Renouveau', emoji: '🌱', color: '#10b981' },
  { id: 'confiance', name: 'Confiance', emoji: '💫', color: '#a855f7' },
  { id: 'protection', name: 'Protection', emoji: '🧿', color: '#3b82f6' },
  { id: 'alignement', name: 'Alignement', emoji: '🌈', color: '#fb923c' },
  { id: 'paix', name: 'Paix', emoji: '🕊️', color: '#94a3b8' },
  { id: 'ancrage', name: 'Ancrage', emoji: '🌿', color: '#16a34a' },
  { id: 'clarte', name: 'Clarté', emoji: '✨', color: '#fbbf24' },
  { id: 'gratitude', name: 'Gratitude', emoji: '💎', color: '#06b6d4' },
  { id: 'liberation', name: 'Libération', emoji: '🦋', color: '#7c3aed' },
  { id: 'manifestation', name: 'Manifestation', emoji: '🌠', color: '#f472b6' },
] as const

export type CircleCategoryId = typeof CIRCLE_CATEGORIES[number]['id']

// 8 modes de guidage Cercles d'Intention (G3)
export const CIRCLE_GUIDANCE_MODES = [
  { id: 'voice', name: 'Voix guidée', emoji: '🎙️', desc: 'Phrases conscientes affichées et/ou lues à voix douce' },
  { id: 'breath', name: 'Respiration synchronisée', emoji: '🫁', desc: '4-7-8 synchronisé pour tous les participants' },
  { id: 'visualization', name: 'Visualisation commune', emoji: '🌀', desc: 'Géométrie sacrée pulsante' },
  { id: 'mental', name: 'Répétition mentale', emoji: '💭', desc: 'Phrase affichée, silence audio' },
  { id: 'silence', name: 'Silence intentionnel', emoji: '🤍', desc: 'Écran sobre, minuteur et prénom focus' },
  { id: 'sound', name: 'Son continu / fréquences', emoji: '〰️', desc: 'Fréquence 528 / 432 / 639 Hz' },
  { id: 'light', name: 'Lumière / symbole', emoji: '✦', desc: 'Symbole adapté à la catégorie' },
  { id: 'pure', name: 'Intention Pure', emoji: '◯', desc: 'Aucun mot — minuteur + prénom receveur + intention' },
] as const

export type CircleGuidanceMode = typeof CIRCLE_GUIDANCE_MODES[number]['id']

export const CIRCLE_ROTATION_MODES = [
  { id: 'auto', name: 'Auto', desc: 'Rotation automatique à intervalle fixe' },
  { id: 'random', name: 'Aléatoire', desc: 'Ordre aléatoire des participants' },
  { id: 'fixed', name: 'Défini', desc: 'Ordre défini par le créateur' },
] as const

export type CircleRotationMode = typeof CIRCLE_ROTATION_MODES[number]['id']

export const CIRCLE_DURATION_PRESETS_SEC = [180, 300, 600, 900] as const // 3, 5, 10, 15 min

// Audio mode auto-switch : mesh ≤8, SFU >8
export const CIRCLE_MESH_MAX_PARTICIPANTS = 8

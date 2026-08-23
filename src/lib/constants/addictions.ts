// MUKTI — Addiction Types
// 13 types d'addictions reconnues (P2)
export const ADDICTION_TYPES = [
  { id: 'tabac', name: 'Tabac', icon: '🚬', color: '#94a3b8' },
  { id: 'alcool', name: 'Alcool', icon: '🍷', color: '#dc2626' },
  { id: 'sucre', name: 'Sucre', icon: '🍰', color: '#f472b6' },
  { id: 'drogue', name: 'Drogues', icon: '⚠️', color: '#ef4444' },
  { id: 'ecran', name: 'Écran / Smartphone', icon: '📱', color: '#06b6d4' },
  { id: 'jeux', name: 'Jeux d\'argent / vidéo', icon: '🎰', color: '#a855f7' },
  { id: 'reseaux_sociaux', name: 'Réseaux sociaux', icon: '📲', color: '#3b82f6' },
  { id: 'pornographie', name: 'Pornographie', icon: '🔒', color: '#7c3aed' },
  { id: 'achats', name: 'Achats compulsifs', icon: '🛍️', color: '#f59e0b' },
  { id: 'nourriture', name: 'Nourriture émotionnelle', icon: '🍔', color: '#fb923c' },
  { id: 'codependance', name: 'Codépendance affective', icon: '💔', color: '#ec4899' },
  { id: 'travail', name: 'Workaholisme', icon: '💼', color: '#64748b' },
  { id: 'autre', name: 'Autre', icon: '✨', color: '#a78bfa' },
] as const

export type AddictionId = typeof ADDICTION_TYPES[number]['id']

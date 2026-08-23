// Catégories missions universelles (P3+)
// NOTE NIYAMA (audit CONFORMITE.md 2026-08-23, écart #4) : les entrées 'note_app'
// ('Noter MUKTI sur App Store' — avis rémunéré) et 'feedback' ('avis constructif' rémunéré)
// ont été SUPPRIMÉES ici. C'est exactement le piège déjà trouvé sur akasha-ai (avis
// rémunéré = violation guidelines stores + risque légal). Ces constantes ne sont
// utilisées nulle part (le vrai système de missions lit la table Postgres
// `mukti.missions`, cf src/app/api/missions/route.ts) — supprimées avant qu'un futur
// dev ne les branche par erreur en les prenant pour la référence canonique.
export const MISSION_CATEGORIES = [
  { id: 'story_share', name: 'Partager en story', icon: '📱', color: '#ec4899', reward: 100, description: 'Partager MUKTI sur les réseaux' },
  { id: 'parrainage', name: 'Parrainer un ami', icon: '🤝', color: '#10b981', reward: 500, description: 'Inviter quelqu\'un qui s\'inscrit' },
  { id: 'video_temoignage', name: 'Vidéo témoignage', icon: '🎬', color: '#f43f5e', reward: 1000, description: 'Témoigner en vidéo' },
  { id: 'completer_profil', name: 'Compléter profil', icon: '✏️', color: '#8b5cf6', reward: 50, description: 'Remplir toutes les infos' },
  { id: 'premiere_session', name: 'Première session', icon: '🌟', color: '#7C3AED', reward: 300, description: 'Lancer ton premier mode anti-addiction' },
  { id: 'premier_cercle', name: 'Premier cercle', icon: '🌌', color: '#06B6D4', reward: 200, description: 'Rejoindre ton premier Cercle d\'Intention' },
  { id: 'streak_7j', name: 'Streak 7 jours', icon: '🔥', color: '#ef4444', reward: 250, description: 'Maintenir une pratique 7 jours' },
  { id: 'inviter_3_amis', name: 'Inviter 3 amis', icon: '👥', color: '#a855f7', reward: 800, description: 'Inviter 3 personnes qui s\'inscrivent' },
] as const

export type MissionCategoryId = typeof MISSION_CATEGORIES[number]['id']

export const MISSION_REWARDS = {
  min_credits: 50,
  max_credits: 1000,
  story_share: 100,
  parrainage: 500,
  video_temoignage: 1000,
  completer_profil: 50,
  premiere_session: 300,
  premier_cercle: 200,
  streak_7j: 250,
  inviter_3_amis: 800,
} as const

// Mission types catalog
export const MISSION_TYPES = ['action', 'share', 'referral', 'meditation', 'community', 'other'] as const
export type MissionType = typeof MISSION_TYPES[number]

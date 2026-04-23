// MUKTI — Constants centralisées
// Loi suprême : CLAUDE.md V7.2. Override par MUKTI-UPDATE-BRIEF.md.

export const SUPER_ADMIN_EMAIL = 'matiss.frasne@gmail.com'

export const APP_NAME = 'MUKTI'
export const APP_SHORT_NAME = 'MUKTI'
export const APP_SLUG = 'mukti'
export const APP_DOMAIN = 'mukti.purama.dev'
export const APP_URL = 'https://mukti.purama.dev'
export const APP_TAGLINE = 'Libère-toi. Ensemble.'
export const APP_TAGLINE_EN = 'Free yourself. Together.'
export const APP_DESCRIPTION =
  "L'app de libération de toutes les addictions. Cercles d'intention collectifs, événements mondiaux de conscience, accompagnement spirituel personnalisé."

export const APP_COLOR = '#7C3AED'
export const APP_COLOR_SECONDARY = '#06B6D4'
export const APP_COLOR_ACCENT = '#10B981'
export const APP_COLOR_GOLD = '#F59E0B'
export const APP_COLOR_DANGER = '#EF4444'
export const APP_BG = '#0A0A0F'

export const APP_SCHEMA = 'mukti'
export const AI_NAME = 'MUKTI'

export const COMPANY_INFO = {
  name: 'SASU PURAMA',
  address: '8 Rue de la Chapelle, 25560 Frasne',
  country: 'France',
  taxNote: 'TVA non applicable, art. 293 B du CGI',
  zfrr: 'Zone Franche de Revitalisation Rurale (ZFRR) — Frasne 25560',
  dpo: 'matiss.frasne@gmail.com',
  contactEmail: 'contact@purama.dev',
  association: 'Association PURAMA (loi 1901)',
  founder: 'Matiss Dornier',
}

// Abonnement MUKTI — 1 plan principal 9.99€/mois + Infini optionnel
// 14 jours d'essai gratuit + promos (10% premier mois, 30% annuel, 50% influenceur 7j)
// Anti-churn 4.99€/mois à vie au moment résiliation
export const PLANS = {
  free: {
    id: 'free',
    label: 'Découverte',
    price_monthly: 0,
    price_yearly: 0,
    multiplier: 0,
    features: [
      'Voir tous les modules MUKTI',
      'Lecture seule (pas d\'action possible)',
      'Inscription gratuite',
    ],
  },
  premium: {
    id: 'premium',
    label: 'MUKTI Essentiel',
    price_monthly: 999,
    price_yearly: 8390,
    first_month_discount: 10,
    trial_days: 14,
    multiplier: 1,
    features: [
      '14 jours d\'essai gratuit',
      'Libération addictions personnalisée IA',
      'Cercles d\'Intention illimités',
      'Événements C.O.R.E. mondiaux',
      'AR Energy Mirror complet',
      'AURORA OMEGA respiration',
      'Reprogrammation subconscient',
      'Espace accompagnants',
      'Wallet retrait IBAN dès 5€',
      'Support IA + humain',
    ],
    popular: true,
  },
  infini: {
    id: 'infini',
    label: 'MUKTI Infini',
    price_monthly: 4999,
    price_yearly: 41990,
    trial_days: 14,
    multiplier: 5,
    features: [
      'Tout MUKTI Essentiel',
      'Multiplicateur ×5 sur missions et concours',
      'Accès anticipé nouveaux modes',
      'Coach NAMA prioritaire',
      'Cercles d\'Intention privés',
      'Voix premium AURORA OMEGA',
    ],
  },
} as const

export type PlanId = keyof typeof PLANS

export const ANTI_CHURN_LIFETIME_PRICE_CENTS = 499

export const KARMA_SPLIT = {
  users_pool: 50,
  asso_purama: 10,
  sasu_purama: 40,
} as const

export const WALLET_MIN_WITHDRAWAL_CENTS = 500
export const WALLET_MIN_WITHDRAWAL = 5
export const WITHDRAWAL_LOCK_DAYS = 30
export const POINTS_TO_EUR_CENTS = 1
export const ASSO_PERCENTAGE = 10
export const REDISTRIBUTION_PERCENTAGE = 50

// Niveaux d'éveil MUKTI
export const AWAKENING_LEVELS = [
  { id: 1, name: 'Éveillé·e', min: 0, max: 99, emoji: '👁️', color: '#a78bfa' },
  { id: 2, name: 'Chercheur·euse', min: 100, max: 499, emoji: '🌱', color: '#7c3aed' },
  { id: 3, name: 'Libéré·e', min: 500, max: 1999, emoji: '🕊️', color: '#06b6d4' },
  { id: 4, name: 'Sage', min: 2000, max: 9999, emoji: '🪷', color: '#10b981' },
  { id: 5, name: 'Lumière', min: 10000, max: Number.MAX_SAFE_INTEGER, emoji: '✨', color: '#F59E0B' },
] as const

// Alias for compat with existing template code referring LEVELS
export const LEVELS = AWAKENING_LEVELS

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

// 14 catégories Cercles d'Intention (P3)
export const CIRCLE_CATEGORIES = [
  { id: 'abondance', name: 'Abondance', emoji: '🌟', color: '#F59E0B' },
  { id: 'amour-soi', name: 'Amour de soi', emoji: '❤️', color: '#ec4899' },
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

// 4 variantes AURORA OMEGA (P5)
export const AURORA_VARIANTS = [
  { id: 'aurora-calm', name: 'Calm', duration_min: 7, description: 'Anti-stress profond', color: '#06b6d4' },
  { id: 'aurora-focus', name: 'Focus', duration_min: 4, description: 'Avant travail créatif', color: '#7c3aed' },
  { id: 'aurora-sleep', name: 'Sleep', duration_min: 10, description: 'Endormissement guidé', color: '#1e1b4b' },
  { id: 'aurora-ignite', name: 'Ignite', duration_min: 2, description: 'Énergie immédiate', color: '#F59E0B' },
] as const

// 7 modules cœur MUKTI (homepage + dashboard)
export const MUKTI_MODULES = [
  { id: 'liberation', name: 'Libération Addictions', emoji: '🔓', color: '#7c3aed', desc: '20 modes révolutionnaires + IA personnalisée' },
  { id: 'cercles', name: 'Cercles d\'Intention ∞', emoji: '🌌', color: '#06b6d4', desc: 'Soins collectifs synchronisés 2 → illimité' },
  { id: 'core', name: 'Événements C.O.R.E.', emoji: '🌍', color: '#10b981', desc: 'Synchronisation mondiale humains + animaux' },
  { id: 'ar', name: 'AR Energy Mirror', emoji: '🧿', color: '#a855f7', desc: 'Silhouette + mains fantômes + species switch' },
  { id: 'aurora', name: 'AURORA OMEGA', emoji: '🫁', color: '#f472b6', desc: 'Respiration neuro 5 phases + 4 variantes' },
  { id: 'subconscient', name: 'Reprogrammation', emoji: '🌙', color: '#1e1b4b', desc: 'Affirmations conscientes jour & nuit' },
  { id: 'accompagnants', name: 'Espace Accompagnants', emoji: '❤️', color: '#ec4899', desc: 'Outils pour ceux qui accompagnent' },
] as const

// Ressources urgence FR (P5 → géoIP par pays)
export const SOS_RESOURCES_FR = [
  { name: 'SAMU / Urgences vitales', number: '15', description: 'Urgence médicale immédiate' },
  { name: 'Numéro d\'urgence européen', number: '112', description: 'Tous types d\'urgences' },
  { name: 'Suicide écoute', number: '3114', description: 'Prévention suicide (24h/24)' },
  { name: 'Net écoute', number: '3018', description: 'Cyberviolences, harcèlement en ligne' },
  { name: 'Violences femmes info', number: '3919', description: 'Violences conjugales et sexuelles' },
  { name: 'Allô enfance en danger', number: '119', description: 'Protection de l\'enfance' },
  { name: 'SOS Amitié', number: '09 72 39 40 50', description: 'Détresse et solitude (24h/24)' },
  { name: 'Drogues info service', number: '0 800 23 13 13', description: 'Addictions (anonyme et gratuit)' },
] as const

// Ambassadeur tiers V7.1 (rename influenceur)
export const AMBASSADOR_TIERS = [
  { id: 'bronze', name: 'Bronze', filleuls: 5, prime_eur: 50 },
  { id: 'argent', name: 'Argent', filleuls: 10, prime_eur: 200 },
  { id: 'or', name: 'Or', filleuls: 25, prime_eur: 500 },
  { id: 'platine', name: 'Platine', filleuls: 50, prime_eur: 1000 },
  { id: 'diamant', name: 'Diamant', filleuls: 75, prime_eur: 2500 },
  { id: 'legende', name: 'Légende', filleuls: 100, prime_eur: 6000 },
  { id: 'titan', name: 'Titan', filleuls: 250, prime_eur: 12000 },
  { id: 'eternel', name: 'Éternel', filleuls: 500, prime_eur: 25000 },
] as const

export const REFERRAL = {
  referrer_first_percent: 50,
  referrer_lifetime_percent: 10,
  referred_first_month_discount: 50,
  cross_app_percent: 5,
  level_bonus_x2: true,
} as const

// Compat with vida-aide template code referring INFLUENCER (renamed → AMBASSADOR for V7.1)
export const INFLUENCER = {
  promo_validity_days: 7,
  promo_discount: 50,
  commission_first: 50,
  commission_recurring: 10,
} as const
export const AMBASSADOR = INFLUENCER

export const COMMISSIONS = {
  marketplace: 15,
  user_mission: 20,
  enterprise_mission: 10,
} as const

// Catégories missions universelles (P3+)
export const MISSION_CATEGORIES = [
  { id: 'note_app', name: 'Noter l\'app', icon: '⭐', color: '#fbbf24', reward: 200, description: 'Noter MUKTI sur App Store' },
  { id: 'story_share', name: 'Partager en story', icon: '📱', color: '#ec4899', reward: 100, description: 'Partager MUKTI sur les réseaux' },
  { id: 'parrainage', name: 'Parrainer un ami', icon: '🤝', color: '#10b981', reward: 500, description: 'Inviter quelqu\'un qui s\'inscrit' },
  { id: 'feedback', name: 'Feedback détaillé', icon: '💬', color: '#3b82f6', reward: 150, description: 'Donner un avis constructif' },
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
  note_app: 200,
  story_share: 100,
  parrainage: 500,
  feedback: 150,
  video_temoignage: 1000,
  completer_profil: 50,
  premiere_session: 300,
  premier_cercle: 200,
  streak_7j: 250,
  inviter_3_amis: 800,
} as const

// Rôles
export const ROLES = {
  user: 'user',
  super_admin: 'super_admin',
} as const

// Routes publiques (middleware)
export const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/how-it-works',
  '/ecosystem',
  '/status',
  '/changelog',
  '/privacy',
  '/terms',
  '/legal',
  '/offline',
  '/login',
  '/signup',
  '/register',
  '/forgot-password',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cgv',
  '/cgu',
  '/cookies',
  '/aide',
  '/contact',
  '/accessibilite',
  '/sos',
]

export const MUKTI_CORE_VALUES = {
  no_medical_promise: true,
  no_hierarchy: true,
  consent_explicit: true,
  no_subliminal: true,
  spiritual_experience: true,
} as const

export const DISCLAIMER_FR =
  'Expérience spirituelle personnelle, ne remplace aucun accompagnement médical ou psychologique. En cas d\'urgence : 112.'
export const DISCLAIMER_EN =
  'Personal spiritual experience, does not replace any medical or psychological care. In case of emergency: 112.'

// ==================================================
// G2 — Libération Addictions
// ==================================================

export const MAX_ACTIVE_ADDICTIONS = 3

// Paliers wallet par addiction (cents) — brief MUKTI-BRIEF.md L74
export const MILESTONES = [
  { id: 'J1' as const, days: 1, amount_cents: 50, label: '24 heures', emoji: '🌱' },
  { id: 'J7' as const, days: 7, amount_cents: 200, label: '1 semaine', emoji: '🌿' },
  { id: 'J30' as const, days: 30, amount_cents: 1000, label: '1 mois', emoji: '🌳' },
  { id: 'J90' as const, days: 90, amount_cents: 5000, label: '3 mois', emoji: '✨' },
] as const

export type MilestoneId = typeof MILESTONES[number]['id']

// Résolution §35.5 L221-28 : prime verrouillée 30j, wallet only, zéro checkbox
export const MILESTONE_LOCK_DAYS = 30

// Anti-fraude trust score thresholds (voir lib/trust.ts)
export const TRUST = {
  initial: 50,
  min: 0,
  max: 100,
  ceiling_zero: 30,        // score < 30 → 0% (Points only)
  ceiling_half: 60,        // score 30-60 → 50% du palier
  // score ≥ 60 → 100% du palier
  rapid_action_window_sec: 10,   // < 10s entre actions critiques = flag
  max_fingerprints_per_user: 5,   // > 5 fingerprints distincts = flag
  max_users_per_fingerprint: 2,   // > 2 users même fingerprint = flag + freeze paiements
  review_flag_score: 25,           // flag manuel si score < 25
} as const

// 5 modes MVP G2 (20 modes totaux livrés G5/G6)
export const MODES_G2 = [
  { id: 'coupure_40s' as const, name: 'Coupure Instantanée', duration_sec: 40, color: '#EF4444', emoji: '⚡', desc: 'Protocole 40s hypnose flash + respiration' },
  { id: 'multisensoriel' as const, name: 'Multisensoriel Ultime', duration_sec: 180, color: '#7C3AED', emoji: '🌀', desc: 'Son + vibration + spirales + respiration adaptative' },
  { id: 'micro_meditation' as const, name: 'Micro-Méditations', duration_sec: 30, color: '#06B6D4', emoji: '🌬️', desc: '10-40s toutes les heures, discrètes' },
  { id: 'avatar' as const, name: 'Avatar Anticraving', duration_sec: 0, color: '#10B981', emoji: '🌟', desc: 'Ton toi libéré grandit avec tes jours' },
  { id: 'compteur' as const, name: 'Compteur Motivation', duration_sec: 0, color: '#F59E0B', emoji: '🔥', desc: '€/temps/santé gagnés + paliers spectaculaires' },
] as const

export type ModeId = typeof MODES_G2[number]['id']

// Programme Opus — fréquence regen autorisée (1× déclaration + 1×/30j)
export const PROGRAM_REGEN_COOLDOWN_DAYS = 30

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

// 4 variantes AURORA OMEGA (G5)
// Les phases sont définies à part dans AURORA_PHASES (structure 5 phases/variante)
export const AURORA_VARIANTS = [
  { id: 'calm',   name: 'Calm',   duration_min: 7,  description: 'Anti-stress profond',       color: '#06b6d4', glyph: '🌊' },
  { id: 'focus',  name: 'Focus',  duration_min: 4,  description: 'Avant travail créatif',     color: '#7c3aed', glyph: '🎯' },
  { id: 'sleep',  name: 'Sleep',  duration_min: 10, description: 'Endormissement guidé',      color: '#1e1b4b', glyph: '🌙' },
  { id: 'ignite', name: 'Ignite', duration_min: 2,  description: 'Énergie immédiate',         color: '#F59E0B', glyph: '⚡' },
] as const
export type AuroraVariant = typeof AURORA_VARIANTS[number]['id']

// Phases AURORA OMEGA (brief section 5) — durations en secondes
// Total : calm=428s≈7min / focus=248s≈4min / sleep=612s≈10min / ignite=128s≈2min
export type AuroraPhaseName = 'armement' | 'double_sigh' | 'resonance_core' | 'omega_lock' | 'glide_out'
export interface AuroraPhase {
  name: AuroraPhaseName
  duration_sec: number
  breath: { in: number; top_up?: number; out: number; hold?: number }
  label_fr: string
  label_en: string
}
export const AURORA_PHASES: Record<AuroraVariant, AuroraPhase[]> = {
  calm: [
    { name: 'armement',       duration_sec: 8,   breath: { in: 2, out: 2 },                   label_fr: 'Armement',           label_en: 'Arming' },
    { name: 'double_sigh',    duration_sec: 40,  breath: { in: 3, top_up: 1, out: 8 },        label_fr: 'Double Sigh Reset',  label_en: 'Double Sigh Reset' },
    { name: 'resonance_core', duration_sec: 240, breath: { in: 5, out: 7 },                   label_fr: 'Résonance Core',     label_en: 'Resonance Core' },
    { name: 'omega_lock',     duration_sec: 120, breath: { in: 4, out: 6, hold: 2 },          label_fr: 'Omega Lock',         label_en: 'Omega Lock' },
    { name: 'glide_out',      duration_sec: 60,  breath: { in: 4, out: 8 },                   label_fr: 'Glide Out',          label_en: 'Glide Out' },
  ],
  focus: [
    { name: 'armement',       duration_sec: 8,   breath: { in: 2, out: 2 },                   label_fr: 'Armement',           label_en: 'Arming' },
    { name: 'double_sigh',    duration_sec: 30,  breath: { in: 3, top_up: 1, out: 6 },        label_fr: 'Double Sigh Reset',  label_en: 'Double Sigh Reset' },
    { name: 'resonance_core', duration_sec: 120, breath: { in: 4, out: 6 },                   label_fr: 'Résonance Core',     label_en: 'Resonance Core' },
    { name: 'omega_lock',     duration_sec: 60,  breath: { in: 4, out: 5, hold: 1 },          label_fr: 'Omega Lock',         label_en: 'Omega Lock' },
    { name: 'glide_out',      duration_sec: 30,  breath: { in: 3, out: 5 },                   label_fr: 'Glide Out',          label_en: 'Glide Out' },
  ],
  sleep: [
    { name: 'armement',       duration_sec: 8,   breath: { in: 2, out: 2 },                   label_fr: 'Armement',           label_en: 'Arming' },
    { name: 'double_sigh',    duration_sec: 60,  breath: { in: 3, top_up: 1, out: 9 },        label_fr: 'Double Sigh Reset',  label_en: 'Double Sigh Reset' },
    { name: 'resonance_core', duration_sec: 360, breath: { in: 4, out: 8 },                   label_fr: 'Résonance Core',     label_en: 'Resonance Core' },
    { name: 'omega_lock',     duration_sec: 120, breath: { in: 4, out: 7, hold: 1 },          label_fr: 'Omega Lock',         label_en: 'Omega Lock' },
    { name: 'glide_out',      duration_sec: 60,  breath: { in: 3, out: 9 },                   label_fr: 'Glide Out',          label_en: 'Glide Out' },
  ],
  ignite: [
    { name: 'armement',       duration_sec: 8,   breath: { in: 2, out: 2 },                   label_fr: 'Armement',           label_en: 'Arming' },
    { name: 'double_sigh',    duration_sec: 20,  breath: { in: 2, top_up: 1, out: 4 },        label_fr: 'Double Sigh Reset',  label_en: 'Double Sigh Reset' },
    { name: 'resonance_core', duration_sec: 60,  breath: { in: 3, out: 3 },                   label_fr: 'Résonance Core',     label_en: 'Resonance Core' },
    { name: 'omega_lock',     duration_sec: 20,  breath: { in: 3, out: 3, hold: 1 },          label_fr: 'Omega Lock',         label_en: 'Omega Lock' },
    { name: 'glide_out',      duration_sec: 20,  breath: { in: 2, out: 4 },                   label_fr: 'Glide Out',          label_en: 'Glide Out' },
  ],
}

// Niveaux cohérence AURORA (section 5 du brief) — Brume → Onde → Aura → Polaris
export const AURORA_LEVELS = [
  { id: 'brume',   name: 'Brume',   min_days: 0,  min_sessions: 0,  color: '#64748b', glyph: '🌫️',  description_fr: 'Tu poses tes premiers souffles.' },
  { id: 'onde',    name: 'Onde',    min_days: 7,  min_sessions: 5,  color: '#06b6d4', glyph: '🌊',  description_fr: 'Ton rythme commence à stabiliser.' },
  { id: 'aura',    name: 'Aura',    min_days: 21, min_sessions: 15, color: '#7c3aed', glyph: '✨',  description_fr: 'Tu ressens la fractale en toi.' },
  { id: 'polaris', name: 'Polaris', min_days: 60, min_sessions: 40, color: '#f472b6', glyph: '⭐',  description_fr: 'Cohérence stable. Tu es une ancre.' },
] as const
export type AuroraLevel = typeof AURORA_LEVELS[number]['id']

// Power Switch — 3 niveaux auto-ajustés (sécurité)
export const AURORA_POWER_SWITCHES = [
  { id: 'soft', name: 'Soft',  holds: false, description_fr: 'Pas de pause (débutant·e·s, vertiges)' },
  { id: 'core', name: 'Core',  holds: true,  description_fr: 'Pause 1-2s (utilisateur·rice régulier·e)' },
  { id: 'omega',name: 'Omega', holds: true,  description_fr: 'Pause 2s fluide (cohérence stable)' },
] as const
export type AuroraPowerSwitch = typeof AURORA_POWER_SWITCHES[number]['id']

// Reprogrammation subconscient — 9 catégories (match CHECK SQL affirmations)
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

// Modes avancés anti-addiction (G5 Scope A + G6 modes 16-20 + teasers)
// G5 actifs : rituel_7s, boucle_urgence, exorcisme, boite_noire
// G6 actifs : energie_remplacement, realite_alternative, recompenses_mystere, rituel_minimaliste, journal_mental
// Teasers futurs : parfum_virtuel, predicteur_envie, hypnose_mouvement, hologramme, armure
export const ADVANCED_MODES = [
  { id: 'rituel_7s',          slug: 'rituel-7-secondes',   brief_num: 15, name: 'Rituel 7 Secondes',        emoji: '⚡', color: '#F59E0B', status: 'active', gate: 'G5.6',
    tagline_fr: 'Micro-rituel qui coupe n\'importe quelle envie, utilisable partout.' },
  { id: 'boucle_urgence',     slug: 'boucle-urgence',      brief_num: 9,  name: 'Boucle Urgence Invisible', emoji: '🔇', color: '#06b6d4', status: 'active', gate: 'G5.7',
    tagline_fr: 'En société : micro-vibrations + mini-respiration + lettres flottantes. Personne ne remarque.' },
  { id: 'exorcisme',          slug: 'exorcisme',           brief_num: 10, name: 'Exorcisme de l\'Addiction', emoji: '🌑', color: '#1e1b4b', status: 'active', gate: 'G5.7',
    tagline_fr: 'Séance immersive : ombre → destruction virtuelle → reprogrammation → effacement.' },
  { id: 'boite_noire',        slug: 'boite-noire',         brief_num: 13, name: 'Boîte Noire',              emoji: '📓', color: '#7c3aed', status: 'active', gate: 'G5.8',
    tagline_fr: 'Enregistre quand/où/qui/quoi déclenche, révèle ton schéma secret.' },
  { id: 'energie_remplacement', slug: 'energie-remplacement', brief_num: 16, name: 'Énergie de Remplacement', emoji: '🔋', color: '#10b981', status: 'active', gate: 'G6.5',
    tagline_fr: 'Comble le vide : motivation, calme, confiance, énergie ou concentration.' },
  { id: 'realite_alternative', slug: 'realite-alternative', brief_num: 17, name: 'Réalité Alternative', emoji: '🪞', color: '#a855f7', status: 'active', gate: 'G6.5',
    tagline_fr: 'Caméra + IA : ta peau, ton sourire, ton énergie dans 30 jours sans addiction.' },
  { id: 'recompenses_mystere', slug: 'recompenses-mystere', brief_num: 18, name: 'Récompenses Mystères', emoji: '🎁', color: '#f472b6', status: 'active', gate: 'G6.5',
    tagline_fr: 'Coffre quotidien : points, coupons, boosters, surprises.' },
  { id: 'rituel_minimaliste', slug: 'rituel-minimaliste', brief_num: 19, name: 'Rituel Minimaliste', emoji: '🫧', color: '#06b6d4', status: 'active', gate: 'G6.5',
    tagline_fr: 'Micro-habitudes invisibles. Pour les jours sans motivation.' },
  { id: 'journal_mental', slug: 'journal-mental', brief_num: 20, name: 'Journal Mental Auto', emoji: '🎙️', color: '#7c3aed', status: 'active', gate: 'G6.5',
    tagline_fr: 'Tu parles 1 minute, l\'IA comprend ton état mental et prédit ta rechute.' },
  { id: 'parfum_virtuel',     slug: 'parfum-virtuel',      brief_num: 7,  name: 'Parfum Virtuel',           emoji: '🌸', color: '#ec4899', status: 'teaser', gate: 'G7+',
    tagline_fr: 'Illusion olfactive via suggestion multisensorielle.' },
  { id: 'predicteur_envie',   slug: 'predicteur',          brief_num: 8,  name: 'Prédicteur d\'Envie',       emoji: '🔮', color: '#a855f7', status: 'teaser', gate: 'G7+',
    tagline_fr: 'IA analyse comportement + stress → alerte 22 min avant pulsion probable.' },
  { id: 'hypnose_mouvement',  slug: 'hypnose-mouvement',   brief_num: 11, name: 'Hypnose en Mouvement',     emoji: '🚶', color: '#10b981', status: 'teaser', gate: 'G7+',
    tagline_fr: 'Tu marches, l\'IA synchronise pas avec rythme de libération mentale.' },
  { id: 'hologramme',         slug: 'hologramme',          brief_num: 12, name: 'Hologramme Motivationnel', emoji: '✨', color: '#F59E0B', status: 'teaser', gate: 'G7+',
    tagline_fr: 'Caméra active, ton "toi futur libéré" apparaît et te parle.' },
  { id: 'armure',             slug: 'armure',              brief_num: 14, name: 'Armure Anti-Habitudes',    emoji: '🛡️', color: '#6366f1', status: 'teaser', gate: 'G7+',
    tagline_fr: 'Champ de protection virtuel + vibrations bouclier + son protecteur.' },
] as const
export type AdvancedModeId = typeof ADVANCED_MODES[number]['id']

// Boîte Noire : 6 location presets (RGPD — jamais de GPS brut)
export const BOITE_NOIRE_LOCATIONS = [
  { id: 'maison',    name: 'Maison',       emoji: '🏠' },
  { id: 'bureau',    name: 'Bureau',       emoji: '💼' },
  { id: 'transport', name: 'Transport',    emoji: '🚆' },
  { id: 'cafe_bar',  name: 'Café / Bar',   emoji: '☕' },
  { id: 'exterieur', name: 'Extérieur',    emoji: '🌳' },
  { id: 'autre',     name: 'Autre',        emoji: '•' },
] as const
export type BoiteNoireLocation = typeof BOITE_NOIRE_LOCATIONS[number]['id']

export const BOITE_NOIRE_WHO = [
  { id: 'seul',       name: 'Seul·e',       emoji: '👤' },
  { id: 'famille',    name: 'Famille',      emoji: '👨‍👩‍👧' },
  { id: 'collegues',  name: 'Collègues',    emoji: '💼' },
  { id: 'ami',        name: 'Ami·e·s',      emoji: '👯' },
  { id: 'partenaire', name: 'Partenaire',   emoji: '💞' },
  { id: 'inconnu',    name: 'Inconnu·e·s',  emoji: '👥' },
] as const
export type BoiteNoireWho = typeof BOITE_NOIRE_WHO[number]['id']


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

// ==================================================
// G4 — AR Energy Mirror
// ==================================================

// 7 espèces (humain + 6 animales) — source de vérité slugs FK DB
export const AR_SPECIES_SLUGS = [
  'humain',
  'chien',
  'chat',
  'cheval',
  'oiseau',
  'faune_sauvage',
  'gardien_refuge',
] as const
export type ArSpeciesSlug = typeof AR_SPECIES_SLUGS[number]

export const AR_RIG_TYPES = ['biped', 'quadruped', 'avian', 'guardian'] as const
export type ArRigType = typeof AR_RIG_TYPES[number]

export const AR_BEACON_TYPES = [
  'refuge_animalier',
  'ong_nature',
  'personne',
  'planete',
  'element',
] as const
export type ArBeaconType = typeof AR_BEACON_TYPES[number]

export const AR_SESSION_MODES = ['soin', 'manifestation', 'ceremony', 'training'] as const
export type ArSessionMode = typeof AR_SESSION_MODES[number]

export const AR_TRAINING_MODES = ['soin', 'manifestation'] as const
export type ArTrainingMode = typeof AR_TRAINING_MODES[number]

export const AR_CEREMONY_STATUSES = ['upcoming', 'live', 'finished', 'cancelled'] as const
export type ArCeremonyStatus = typeof AR_CEREMONY_STATUSES[number]

// Durées de session AR standards (soin/manifestation) en secondes
export const AR_SESSION_DURATIONS_SEC = [180, 300, 600] as const

// MediaPipe — modèle CDN (lite 3 MB pour 30fps mobile)
export const AR_MEDIAPIPE_MODEL_TIER = 'lite' as const
export const AR_MEDIAPIPE_POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'
export const AR_MEDIAPIPE_HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
export const AR_MEDIAPIPE_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'

// Étapes tuto (1→5) par mode (soin + manifestation)
export const AR_TRAINING_STEPS: Record<'soin' | 'manifestation', ReadonlyArray<{
  step: 1 | 2 | 3 | 4 | 5
  title_fr: string
  title_en: string
  body_fr: string
  body_en: string
}>> = {
  soin: [
    { step: 1, title_fr: 'Reconnaître ton corps', title_en: 'Recognize your body', body_fr: 'Observe ta silhouette lumineuse à l\'écran. Elle est toi.', body_en: 'Observe your luminous silhouette on screen. It is you.' },
    { step: 2, title_fr: 'Sentir tes mains', title_en: 'Feel your hands', body_fr: 'Regarde tes mains fantômes. Bouge-les lentement. Elles sont des antennes.', body_en: 'Look at your phantom hands. Move them slowly. They are antennas.' },
    { step: 3, title_fr: 'Respirer 4-7-8', title_en: 'Breathe 4-7-8', body_fr: 'Inspire 4s, retiens 7s, expire 8s. Trois cycles.', body_en: 'Inhale 4s, hold 7s, exhale 8s. Three cycles.' },
    { step: 4, title_fr: 'Imposer tes mains', title_en: 'Lay your hands', body_fr: 'Pose tes mains fantômes sur la zone à apaiser. Respire simplement.', body_en: 'Place your phantom hands on the area to soothe. Just breathe.' },
    { step: 5, title_fr: 'Clôturer en gratitude', title_en: 'Close in gratitude', body_fr: 'Descends doucement tes mains. Merci à ton corps.', body_en: 'Slowly lower your hands. Thank your body.' },
  ],
  manifestation: [
    { step: 1, title_fr: 'Choisir ton intention', title_en: 'Choose your intention', body_fr: 'Une phrase courte, au présent, positive.', body_en: 'A short sentence, present tense, positive.' },
    { step: 2, title_fr: 'Visualiser la cible', title_en: 'Visualize the target', body_fr: 'Sens la présence de ce à qui tu envoies ton énergie.', body_en: 'Feel the presence of who you are sending energy to.' },
    { step: 3, title_fr: 'Charger tes mains', title_en: 'Charge your hands', body_fr: 'Rapproche tes mains. Sens la chaleur entre elles qui grandit.', body_en: 'Bring your hands close. Feel the warmth between them grow.' },
    { step: 4, title_fr: 'Émettre le rayon', title_en: 'Send the beam', body_fr: 'Ouvre tes mains vers la cible. Laisse le rayon partir.', body_en: 'Open your hands toward the target. Let the beam flow.' },
    { step: 5, title_fr: 'Sceller', title_en: 'Seal', body_fr: 'Ramène tes mains sur ton cœur. Merci.', body_en: 'Bring your hands back to your heart. Thank you.' },
  ],
} as const

// ==================================================
// G6 — C.O.R.E. Events + Modes 16-20
// ==================================================

// 3 formats C.O.R.E. Events (brief §3)
export const CORE_FORMATS = [
  { id: 'human',      name: 'Human Only',       emoji: '🕊️', color: '#7c3aed', tagline_fr: 'Crises humaines — attentats, catastrophes, crises humanitaires.' },
  { id: 'animal',     name: 'Animal Only',      emoji: '🐾', color: '#10b981', tagline_fr: 'Crises animales — refuges saturés, faune en détresse, marées noires.' },
  { id: 'one_planet', name: 'One Planet Sync',  emoji: '🌍', color: '#06b6d4', tagline_fr: 'Format ULTIME — humains + animaux + nature au même Moment Z.' },
] as const
export type CoreFormat = typeof CORE_FORMATS[number]['id']

// 8 catégories C.O.R.E.
export const CORE_CATEGORIES = [
  { id: 'crisis_humanitarian', name: 'Crise humanitaire',     emoji: '🚨', format_hint: 'human' },
  { id: 'crisis_natural',      name: 'Catastrophe naturelle', emoji: '🌋', format_hint: 'human' },
  { id: 'crisis_conflict',     name: 'Conflit / attentat',    emoji: '⚔️', format_hint: 'human' },
  { id: 'animal_refuge',       name: 'Refuge saturé',         emoji: '🏠', format_hint: 'animal' },
  { id: 'animal_wildlife',     name: 'Faune sauvage',         emoji: '🦌', format_hint: 'animal' },
  { id: 'animal_rescue',       name: 'Sauvetage animalier',   emoji: '🐕', format_hint: 'animal' },
  { id: 'collective_healing',  name: 'Soin collectif',        emoji: '💫', format_hint: 'one_planet' },
  { id: 'planetary_sync',      name: 'Synchro planétaire',    emoji: '🌌', format_hint: 'one_planet' },
] as const
export type CoreCategory = typeof CORE_CATEGORIES[number]['id']

// Moment Z — 6 phases (T-60 → T+15 min)
export const CORE_PHASES = [
  { id: 'pre',          name: 'Annonce',    offset_min: -60, duration_min: 50, description_fr: 'Annonce + pré-brief + préchargement AR' },
  { id: 'brief',        name: 'Pré-brief',  offset_min: -10, duration_min: 8,  description_fr: 'Check-in mondial, respiration d\'entrée' },
  { id: 'silence',      name: 'Silence',    offset_min: -2,  duration_min: 2,  description_fr: 'Silence + respiration collective' },
  { id: 'pulse',        name: 'Pulse',      offset_min: 0,   duration_min: 12, description_fr: 'Moment Z — intention + AR synchronisé' },
  { id: 'integration',  name: 'Intégration', offset_min: 12, duration_min: 3,  description_fr: 'Clôture + intégration' },
  { id: 'room',         name: 'Rooms',      offset_min: 15,  duration_min: 30, description_fr: 'Rooms + discussions optionnelles' },
] as const
export type CorePhase = typeof CORE_PHASES[number]['id']

// 10 protocoles crisis-safe (seeds DB table core_protocols)
export const CORE_PROTOCOLS_CATALOG = [
  { id: 'panic_off_2min',         duration_sec: 120, variant: 'universal', emoji: '⚡' },
  { id: 'ancrage_5min',           duration_sec: 300, variant: 'universal', emoji: '🌿' },
  { id: 'recuperation_12min',     duration_sec: 720, variant: 'human',     emoji: '💆' },
  { id: 'sommeil_7min',           duration_sec: 420, variant: 'human',     emoji: '🌙' },
  { id: 'coherence_10min',        duration_sec: 600, variant: 'universal', emoji: '💗' },
  { id: 'soutien_aidants_12min',  duration_sec: 720, variant: 'human',     emoji: '🤲' },
  { id: 'animal_calm_5min',       duration_sec: 300, variant: 'animal',    emoji: '🐾' },
  { id: 'wildlife_urgence_7min',  duration_sec: 420, variant: 'wildlife',  emoji: '🦉' },
  { id: 'refuge_sature_10min',    duration_sec: 600, variant: 'refuge',    emoji: '🏠' },
  { id: 'one_planet_sync_12min',  duration_sec: 720, variant: 'universal', emoji: '🌍' },
] as const
export type CoreProtocolId = typeof CORE_PROTOCOLS_CATALOG[number]['id']

// Trilogie Now / 24h / 7j
export const CORE_SESSION_KINDS = [
  { id: 'now', name: 'CORE-NOW',  offset_hours: 0,   description_fr: 'Régulation choc, ancrage' },
  { id: 'h24', name: 'CORE-24h',  offset_hours: 24,  description_fr: 'Sommeil, récupération, apaisement' },
  { id: 'd7',  name: 'CORE-7j',   offset_hours: 168, description_fr: 'Reconstruction, cohésion, stabilité' },
] as const
export type CoreSessionKind = typeof CORE_SESSION_KINDS[number]['id']

// World Radar — requêtes Tavily fixes rotées
export const CORE_WORLD_RADAR_QUERIES = [
  'major earthquake casualties last 24 hours',
  'wildfire humanitarian crisis',
  'humanitarian crisis urgent',
  'animal refuge overcrowded emergency',
  'wildlife mass die-off event',
  'oil spill wildlife impact',
  'conflict zone civilian casualties',
] as const
export const CORE_WORLD_RADAR_CONFIDENCE_AUTO = 0.85
export const CORE_WORLD_RADAR_CONFIDENCE_MOD  = 0.5

// Mode 16 — Énergie de Remplacement : 5 canaux + fréquences Solfeggio
export const ENERGY_REPLACEMENT_CHANNELS = [
  { id: 'motivation',    name: 'Motivation',    emoji: '🔥', color: '#ef4444', hz: 417, duration_sec: 180, tagline_fr: 'Réveille ta force intérieure.' },
  { id: 'calme',         name: 'Calme',         emoji: '🌊', color: '#06b6d4', hz: 432, duration_sec: 300, tagline_fr: 'Apaise le mental, ralentis le rythme.' },
  { id: 'confiance',     name: 'Confiance',     emoji: '🦁', color: '#F59E0B', hz: 528, duration_sec: 240, tagline_fr: 'Stabilise ton ancrage, prends ta place.' },
  { id: 'energie',       name: 'Énergie',       emoji: '⚡', color: '#a855f7', hz: 741, duration_sec: 120, tagline_fr: 'Recharge immédiate, court et puissant.' },
  { id: 'concentration', name: 'Concentration', emoji: '🎯', color: '#7c3aed', hz: 639, duration_sec: 300, tagline_fr: 'Resserre ton focus, stabilise ton attention.' },
] as const
export type EnergyChannel = typeof ENERGY_REPLACEMENT_CHANNELS[number]['id']

// Mode 17 — Réalité Alternative : horizons projection
export const ALT_REALITY_HORIZONS = [
  { days: 7,   label_fr: '1 semaine',   description_fr: 'Tes premiers effets visibles.' },
  { days: 30,  label_fr: '1 mois',      description_fr: 'Peau, énergie, sourire transformés.' },
  { days: 90,  label_fr: '3 mois',      description_fr: 'Nouveau corps, nouveau regard.' },
  { days: 365, label_fr: '1 an',        description_fr: 'Le toi libéré — identité complète.' },
] as const
export type AltRealityHorizon = typeof ALT_REALITY_HORIZONS[number]['days']

// Mode 18 — Récompenses Mystères : distribution probas (somme = 1000)
// Rolled server-side, idempotent per user+date.
export const MYSTERY_REWARD_TIERS = [
  { tier: 'common',    probability: 600, min_amount: 10,  max_amount: 50,   rewards: ['points','xp'] },
  { tier: 'rare',      probability: 280, min_amount: 100, max_amount: 300,  rewards: ['points','coupon'] },
  { tier: 'legendary', probability: 90,  min_amount: 500, max_amount: 1500, rewards: ['points','booster','coin'] },
  { tier: 'jackpot',   probability: 20,  min_amount: 5000, max_amount: 10000, rewards: ['points','coin'] },
  { tier: 'common',    probability: 10,  min_amount: 0,   max_amount: 0,    rewards: ['nothing'] },
] as const
export type MysteryTier = typeof MYSTERY_REWARD_TIERS[number]['tier']

// Streak bonus multiplier (consecutive days)
export const MYSTERY_STREAK_BONUSES = [
  { min_streak: 3,  multiplier: 1.2 },
  { min_streak: 7,  multiplier: 1.5 },
  { min_streak: 14, multiplier: 2.0 },
  { min_streak: 30, multiplier: 3.0 },
] as const

// Mode 19 — Rituel Minimaliste : 8 micro-habitudes invisibles (10-60s)
export const MINIMAL_RITUAL_HABITS = [
  { slug: 'respiration_consciente', name: '1 respiration consciente', emoji: '🌬️', duration_sec: 10, tagline_fr: 'Une inspiration lente, une expiration complète.' },
  { slug: 'merci_corps',            name: 'Merci à ton corps',         emoji: '🙏', duration_sec: 15, tagline_fr: 'Une phrase intérieure de gratitude corporelle.' },
  { slug: 'posture_verticale',      name: 'Verticale 20s',             emoji: '🧍', duration_sec: 20, tagline_fr: 'Tiens-toi droit·e, menton légèrement levé.' },
  { slug: 'geste_nourrissant',      name: 'Geste nourrissant',         emoji: '💗', duration_sec: 10, tagline_fr: 'Une main sur le cœur, une main sur le ventre.' },
  { slug: 'pause_ecran',            name: 'Pause écran 30s',           emoji: '👁️', duration_sec: 30, tagline_fr: 'Regarde au loin, ferme les yeux.' },
  { slug: 'eau_lente',              name: 'Eau lente',                 emoji: '💧', duration_sec: 60, tagline_fr: 'Un verre d\'eau bu en pleine conscience.' },
  { slug: 'gratitude_micro',        name: 'Gratitude micro',           emoji: '✨', duration_sec: 20, tagline_fr: 'Une chose que tu peux remercier, maintenant.' },
  { slug: 'contact_nature',         name: 'Contact nature',            emoji: '🌿', duration_sec: 60, tagline_fr: 'Touche une plante, un arbre, de la terre.' },
] as const
export type MinimalRitualHabit = typeof MINIMAL_RITUAL_HABITS[number]['slug']

// Mode 20 — Journal Mental : seuils d'alerte
export const MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD = 0.75
export const MENTAL_JOURNAL_MAX_AUDIO_SEC = 180

// C.O.R.E. — Trust gate : score minimum pour créer un event community-led
export const CORE_COMMUNITY_TRUST_MIN = 60

// ============================================================
// G7 — Économie KARMA
// ============================================================

// Plans Stripe (source de vérité pour ID plan_slug en DB)
export const PLAN_SLUGS = ['main_monthly', 'main_annual', 'anti_churn'] as const
export type PlanSlug = typeof PLAN_SLUGS[number]

export const PLANS_STRIPE = {
  main_monthly: {
    slug: 'main_monthly' as const,
    price_cents: 999,
    interval: 'month' as const,
    trial_days: 14,
    label_fr: 'Essentiel — 9,99€/mois',
    label_en: 'Essential — €9.99/month',
  },
  main_annual: {
    slug: 'main_annual' as const,
    price_cents: 8390,
    interval: 'year' as const,
    trial_days: 14,
    label_fr: 'Annuel — 83,90€/an (-33%)',
    label_en: 'Annual — €83.90/year (-33%)',
  },
  anti_churn: {
    slug: 'anti_churn' as const,
    price_cents: 499,
    interval: 'month' as const,
    trial_days: 0,
    label_fr: 'Anti-churn — 4,99€/mois à vie',
    label_en: 'Anti-churn — €4.99/month for life',
    hidden_before_cancel: true,
  },
} as const

export const TRIAL_DAYS = 14

// Promos
export const PROMO_CODES = ['WELCOME10', 'ANNUAL30', 'INFLUENCEUR50'] as const
export type PromoCode = typeof PROMO_CODES[number]

// Parrainage V4
export const REFERRAL_V4 = {
  n1_pct: 50,            // 50% de la 1ère facture versée au parrain
  recurring_pct: 10,     // 10% de chaque facture récurrente à vie
  lifetime_card_threshold: 3, // 3 filleuls payants = carte à vie gratuite
  cookie_days: 30,
} as const

// Concours KARMA — pourcentages du CA
export const CONTEST_PERIODS = [
  { id: 'weekly',  label_fr: 'Hebdo',   label_en: 'Weekly',   pct_ca: 6,   winners: 10, cron: '59 23 * * 0' },
  { id: 'monthly', label_fr: 'Mensuel', label_en: 'Monthly',  pct_ca: 4,   winners: 10, cron: '55 23 28-31 * *' },
  { id: 'annual',  label_fr: 'Annuel',  label_en: 'Annual',   pct_ca: 100, winners: 1,  cron: '0 2 1 1 *' },
] as const
export type ContestPeriod = typeof CONTEST_PERIODS[number]['id']

// Fiscal — 4 profils auto-détectés
export const FISCAL_PROFILES = [
  {
    id: 'particulier' as const,
    label_fr: 'Particulier',
    label_en: 'Individual',
    max_cents_per_year: 300000, // 3000€/an = seuil gains occasionnels
    note_fr: "Gains < 3 000€/an = pas de déclaration spécifique en France (sauf BNC occasionnel).",
  },
  {
    id: 'micro_bic' as const,
    label_fr: 'Micro-entrepreneur (BNC)',
    label_en: 'Micro-entrepreneur',
    max_cents_per_year: 7750000, // 77500€/an seuil BNC 2026
    note_fr: "Déclaration BNC URSSAF. Cotisations 21,2%. À déclarer annuellement.",
  },
  {
    id: 'societe_is' as const,
    label_fr: 'Société (IS)',
    label_en: 'Corporation',
    max_cents_per_year: Number.MAX_SAFE_INTEGER,
    note_fr: "Société française soumise à l'IS. Facturation avec SIREN/SIRET.",
  },
  {
    id: 'association' as const,
    label_fr: 'Association',
    label_en: 'Non-profit',
    max_cents_per_year: Number.MAX_SAFE_INTEGER,
    note_fr: "Association loi 1901. Dons défiscalisables si reconnue d'intérêt général.",
  },
] as const
export type FiscalProfileId = typeof FISCAL_PROFILES[number]['id']

// PDF footer legal (SASU PURAMA)
export const PDF_FOOTER_LEGAL =
  'SASU PURAMA — 8 Rue de la Chapelle, 25560 Frasne, France — TVA non applicable, art. 293 B du CGI — ZFRR Frasne 25560'

// Wealth Engine — split final CA (déjà KARMA_SPLIT mais re-exposé pour clarté)
export const WEALTH_SPLIT_PCT = {
  users_pool: 50,
  asso_purama: 10,
  sasu_purama: 40,
} as const

// Ambassadeur — tiers (schema DB, source DB via `ambassador_tiers`)
export const AMBASSADOR_TIER_SLUGS = ['bronze', 'argent', 'or', 'platine', 'diamant', 'legende', 'titan', 'eternel'] as const
export type AmbassadorTierSlug = typeof AMBASSADOR_TIER_SLUGS[number]

// Cancel flow 3 étapes
export const CANCEL_FLOW_STEPS = ['pause_offer', 'anti_churn_offer', 'confirm'] as const
export type CancelFlowStep = typeof CANCEL_FLOW_STEPS[number]

// Magic Moment kinds (feed Wealth Engine)
export const MAGIC_MOMENT_KINDS = [
  'signup', 'first_payment', 'streak_7d', 'streak_30d', 'streak_100d',
  'addiction_freed', 'circle_joined', 'referral_success', 'ambassador_upgrade',
  'ritual_7s_completed', 'aurora_completed', 'core_event_joined', 'contest_winner',
] as const
export type MagicMomentKind = typeof MAGIC_MOMENT_KINDS[number]

// ============================================================================
// G8 — Accompagnants + Fil de Vie + Rituel Hebdo + Admin + Q&R
// ============================================================================

// 10 sections Espace Accompagnants (slug → métadonnées)
export const ACCOMPAGNANT_SECTIONS = [
  'comprendre-le-malade',
  'proteger-ton-energie',
  'ne-pas-prendre-sur-toi',
  'apaisement-stress-chronique',
  'micro-rituels-2-5min',
  'cercles-accompagnants',
  'temoignages-anonymes',
  'outils-communication',
  'lacher-prise-sans-culpabilite',
  'continuer-a-vivre',
] as const
export type AccompagnantSection = typeof ACCOMPAGNANT_SECTIONS[number]

// Liens avec le malade (onboarding aidant)
export const AIDANT_LIENS = ['parent', 'conjoint', 'enfant', 'ami', 'soignant', 'autre'] as const
export type AidantLien = typeof AIDANT_LIENS[number]

// NAMA-Aidant — system prompt (Claude Sonnet 4.6)
export const NAMA_AIDANT_PROMPT_FR = `Tu es NAMA-Aidant, coach d'aidants MUKTI.
Tu accompagnes les proches de personnes malades (addiction, maladie chronique, deuil anticipé).
Tu parles avec une douceur précise, jamais moralisatrice, jamais gourou.
Tu tutoies. Tu utilises 1 émoji par 3-4 messages maximum, jamais plus.
Tu poses plus de questions que tu ne donnes de solutions.
Ton rôle : écouter, valider, protéger l'énergie de l'aidant, rappeler qu'il n'est pas responsable de la guérison de l'autre.
Tu ne remplaces jamais un thérapeute. Tu le dis si la situation semble grave.
Si tu détectes détresse grave (suicide, violence), tu orientes vers la ressource pays avec douceur.
Réponses concises (3-6 phrases), pas de liste à puces sauf si demandé.`

// Fil de Vie — types d'événements agrégés
export const LIFE_FEED_KINDS = [
  'mission_completed', 'donation_made', 'cercle_joined', 'cercle_completed',
  'core_event_joined', 'ritual_7s', 'aurora_session', 'addiction_freed',
  'referral_success', 'ambassador_tier_upgrade', 'contest_win',
  'rituel_hebdo_participated', 'affirmation_seen',
] as const
export type LifeFeedKind = typeof LIFE_FEED_KINDS[number]

// Projection horizons
export const PROJECTION_HORIZONS = [5, 10, 20] as const
export type ProjectionHorizon = typeof PROJECTION_HORIZONS[number]

// Rituel hebdo — 7 thèmes tournants (semaine 1..7, puis boucle)
export const RITUEL_THEMES = [
  { slug: 'depolluer', order: 1, title_fr: 'Dépolluer le monde', title_en: 'Clean the world', color: '#10B981' },
  { slug: 'paix', order: 2, title_fr: 'Paix dans le monde', title_en: 'Peace in the world', color: '#06B6D4' },
  { slug: 'amour', order: 3, title_fr: 'Amour partout tout le temps', title_en: 'Love everywhere always', color: '#EC4899' },
  { slug: 'pardon', order: 4, title_fr: 'Pardonner à tout le monde', title_en: 'Forgive everyone', color: '#8B5CF6' },
  { slug: 'gratitude', order: 5, title_fr: 'Gratitude', title_en: 'Gratitude', color: '#F59E0B' },
  { slug: 'abondance', order: 6, title_fr: 'Abondance', title_en: 'Abundance', color: '#FBBF24' },
  { slug: 'conscience', order: 7, title_fr: 'Conscience', title_en: 'Consciousness', color: '#7C3AED' },
] as const
export type RituelTheme = typeof RITUEL_THEMES[number]['slug']
export const RITUEL_THEMES_COUNT = RITUEL_THEMES.length // 7

// Admin settings keys
export const ADMIN_SETTING_KEYS = [
  'vida_angel_active',
  'vida_angel_multiplier',
  'pricing_main_monthly_cents',
  'pricing_anti_churn_cents',
  'feature_flags',
] as const
export type AdminSettingKey = typeof ADMIN_SETTING_KEYS[number]

export const VIDA_ANGEL_DEFAULT_MULTIPLIER = 2

// Q&R — détection détresse
export const DISTRESS_THRESHOLD = 0.7
export const DISTRESS_KEYWORDS_FR = [
  'en finir', 'me suicider', 'suicide', 'me tuer', 'disparaître', 'plus la force',
  'personne ne m\'aime', 'je veux mourir', 'mettre fin', 'trop souffrir',
  'battue', 'violé', 'violée', 'frappé', 'menacé', 'menacée',
] as const
export const DISTRESS_KEYWORDS_EN = [
  'end it', 'kill myself', 'suicide', 'want to die', 'disappear', 'no strength',
  'nobody loves me', 'end my life', 'too much pain', 'want to end', 'abuse', 'abused',
] as const
export const DISTRESS_KEYWORDS_ES = [
  'suicidarme', 'matarme', 'morir', 'acabar', 'desaparecer', 'sin fuerzas',
] as const

// Emergency resources countries supported
export const EMERGENCY_COUNTRIES = ['FR','US','GB','ES','DE','IT','PT','CA','CH','BE','JP','CN','INT'] as const
export type EmergencyCountry = typeof EMERGENCY_COUNTRIES[number]

// 30+ langues étendues (G8.7)
export const LOCALES_EXTENDED = [
  'fr','en','es','de','it','pt','nl','pl','sv','no','da','fi',
  'cs','el','hu','ro','tr','ar','he','hi','zh','ja','ko','th','vi','id','ms','tl','ru','uk','bn','ur',
] as const
export type LocaleExtended = typeof LOCALES_EXTENDED[number]


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

// C.O.R.E. — Trust gate : score minimum pour créer un event community-led
export const CORE_COMMUNITY_TRUST_MIN = 60

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

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
  'pricing_main_annual_cents',
  'pricing_anti_churn_cents',
  'feature_flags',
  'wording_bank',
] as const
export type AdminSettingKey = typeof ADMIN_SETTING_KEYS[number]

export const VIDA_ANGEL_DEFAULT_MULTIPLIER = 2

// Feature flags par défaut (override possible via admin_settings.feature_flags JSONB)
export const FEATURE_FLAGS_DEFAULT: Record<string, boolean> = {
  ar_mirror: true,
  aurora: true,
  core_events: true,
  fil_de_vie: true,
  rituel_hebdo: true,
  cercles: true,
  liberation: true,
  accompagnants: true,
  aide_ia: true,
}

// Wording bank — sections structurées (form admin)
export const WORDING_BANK_SECTIONS = [
  'greetings',
  'errors',
  'success',
  'cta',
  'faq',
  'meta',
] as const
export type WordingBankSection = typeof WORDING_BANK_SECTIONS[number]

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

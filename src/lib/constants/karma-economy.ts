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
    label_fr: 'Annuel — 83,90€/an (-30%)',
    label_en: 'Annual — €83.90/year (-30%)',
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

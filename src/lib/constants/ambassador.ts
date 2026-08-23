// MUKTI — Ambassadeur / Parrainage
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

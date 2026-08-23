// MUKTI — Plans & Pricing
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

// MUKTI — types DB (schema mukti)

export type Role = 'user' | 'super_admin'
export type Plan = 'free' | 'premium'
export type SubscriptionInterval = 'monthly' | 'yearly'
export type Theme = 'dark' | 'light' | 'auto'

export interface Address {
  street?: string
  city?: string
  zip?: string
  country?: string
}

export interface Situation {
  emploi?: 'salarie' | 'cadre' | 'independant' | 'fonctionnaire' | 'chomeur' | 'etudiant' | 'retraite' | 'sans_emploi' | 'frontalier'
  pays_frontalier?: 'CH' | 'LU' | 'DE' | 'BE' | 'IT' | 'ES' | 'MC' | 'AD' | null
  revenus_mensuels_nets?: number
  revenus_annuels_bruts?: number
  logement?: 'locataire' | 'proprietaire' | 'heberge' | 'sans_domicile'
  loyer_mensuel?: number
  famille?: 'celibataire' | 'couple' | 'pacs' | 'marie' | 'divorce' | 'veuf'
  enfants?: number
  enfants_a_charge?: number
  handicap?: boolean
  handicap_taux?: number
  region?: string
  age?: number
}

export interface Profile {
  id: string
  auth_user_id: string
  email: string
  full_name: string | null
  phone: string | null
  birth_date: string | null
  address: Address | null
  situation: Situation | null
  role: Role
  subscription_plan: Plan
  subscription_interval: SubscriptionInterval | null
  trial_ends_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  referral_code: string | null
  referred_by: string | null
  wallet_balance: number
  purama_points: number
  total_money_recovered: number
  total_demarches_launched: number
  level: number
  xp: number
  streak_days: number
  language: string
  theme: Theme
  onboarded: boolean
  tutorial_completed: boolean
  iban: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ScanType = 'financial' | 'fiscal' | 'forgotten_money' | 'juridique'

export interface ScanResultItem {
  aide: string
  category: string
  montant_estime: number
  unite: 'an' | 'mois' | 'unique'
  eligibilite: string
  conditions: string[]
  demarche: string
  lien_officiel?: string
  difficulte: 'facile' | 'moyen' | 'complexe'
  delai_jours?: number
  organisme: string
}

export interface Scan {
  id: string
  user_id: string
  type: ScanType
  input_data: Situation
  results: ScanResultItem[]
  total_recoverable: number
  total_recoverable_monthly: number
  status: 'processing' | 'completed' | 'failed'
  ai_summary: string | null
  created_at: string
}

export interface Message {
  id: string
  user_id: string
  conversation_id: string | null
  scan_id: string | null
  role: 'user' | 'assistant'
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface Mission {
  id: string
  title: string
  description: string
  category: string
  type: 'daily' | 'weekly' | 'monthly' | 'collective' | 'one_shot'
  reward_euros: number
  reward_points: number
  reward_contest_places: number
  max_participants: number | null
  current_participants: number
  active: boolean
  difficulty: 'facile' | 'moyen' | 'difficile'
  proof_type: 'photo' | 'screenshot' | 'auto' | 'none'
  metadata: Record<string, unknown>
  created_at: string
}

export interface MissionCompletion {
  id: string
  user_id: string
  mission_id: string
  proof_url: string | null
  status: 'pending' | 'validated' | 'rejected'
  reward_paid: boolean
  reward_paid_at: string | null
  created_at: string
  mission?: Mission
}

export interface Contest {
  id: string
  title: string
  description: string | null
  type: 'weekly' | 'monthly' | 'yearly' | 'special'
  prizes: Array<{ rank: number; description: string; value_cents: number }>
  total_pool_cents: number
  start_date: string
  end_date: string
  winners: Array<{ user_id: string; rank: number; prize: string }> | null
  status: 'upcoming' | 'live' | 'completed' | 'cancelled'
  image_url: string | null
  created_at: string
}

export interface ContestEntry {
  id: string
  user_id: string
  contest_id: string
  places: number
  created_at: string
}

export interface Referral {
  id: string
  referrer_id: string
  referred_id: string | null
  code: string
  type: 'user' | 'influencer'
  promo_percent: number
  promo_expires_at: string | null
  commission_first: number
  commission_recurring: number
  status: 'pending' | 'converted' | 'active' | 'churned'
  total_earned: number
  created_at: string
  converted_at: string | null
}

export interface WalletTransaction {
  id: string
  user_id: string
  amount: number
  type: 'mission' | 'referral' | 'redistribution' | 'cashback' | 'withdrawal' | 'contest_prize' | 'bonus' | 'refund'
  description: string | null
  status: 'pending' | 'completed' | 'failed'
  source_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  stripe_payment_id: string | null
  stripe_invoice_id: string | null
  amount: number
  currency: string
  type: 'subscription' | 'contest_entry' | 'one_shot'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  metadata: Record<string, unknown>
  created_at: string
}

export interface Demarche {
  id: string
  user_id: string
  scan_id: string | null
  aide_name: string
  category: string
  organisme: string
  montant_estime: number
  status: 'draft' | 'preparing' | 'submitted' | 'in_progress' | 'accepted' | 'rejected' | 'completed'
  lettre_url: string | null
  reference_dossier: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  action_url: string | null
  icon: string | null
  read: boolean
  read_at: string | null
  created_at: string
}

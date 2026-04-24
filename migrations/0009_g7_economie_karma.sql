-- ============================================================
-- MUKTI — G7 Économie KARMA complète
-- Migration 0009 : Stripe + anti-churn + parrainage V4 + ambassadeurs + concours
--   + Stripe Connect + fiscal 4 profils + Wealth Engine Phase 1
-- Patterns G1-G6 : schema mukti, user_id → mukti.profiles(id), RLS via current_profile_id().
-- ============================================================

SET search_path = mukti, public;

-- ============================================================
-- 1. subscriptions — Abonnements Stripe (source de vérité)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  plan_slug TEXT NOT NULL CHECK (plan_slug IN ('main_monthly','main_annual','anti_churn')),
  status TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','unpaid','incomplete')),
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  promo_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON mukti.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON mukti.subscriptions(status) WHERE status IN ('trialing','active','past_due');
ALTER TABLE mukti.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_self_select" ON mukti.subscriptions;
CREATE POLICY "subs_self_select" ON mukti.subscriptions FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());

-- ============================================================
-- 2. payments — Historique paiements Stripe + split 50/10/40
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES mukti.subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  split_user_cents INTEGER NOT NULL DEFAULT 0,
  split_asso_cents INTEGER NOT NULL DEFAULT 0,
  split_sasu_cents INTEGER NOT NULL DEFAULT 0,
  split_applied BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('paid','refunded','failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON mukti.payments(user_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_paid ON mukti.payments(paid_at DESC) WHERE status = 'paid';
ALTER TABLE mukti.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_self_select" ON mukti.payments;
CREATE POLICY "payments_self_select" ON mukti.payments FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());

-- ============================================================
-- 3. processed_stripe_events — idempotence webhook
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE mukti.processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. promos — Codes promos Stripe
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','amount')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  duration TEXT NOT NULL CHECK (duration IN ('once','forever','repeating')),
  duration_in_months INTEGER,
  valid_until TIMESTAMPTZ,
  max_redemptions INTEGER,
  redemptions_count INTEGER NOT NULL DEFAULT 0,
  stripe_coupon_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE mukti.promos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promos_public_read" ON mukti.promos;
CREATE POLICY "promos_public_read" ON mukti.promos FOR SELECT TO anon, authenticated USING (active = true);

-- ============================================================
-- 5. referrals_v4 — Parrainage V4 (N1 50% + récurrent 10% + carte à vie)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.referrals_v4 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  cookie_hit_at TIMESTAMPTZ,
  signup_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_payment_at TIMESTAMPTZ,
  earned_n1_cents INTEGER NOT NULL DEFAULT 0,
  earned_recurring_cents INTEGER NOT NULL DEFAULT 0,
  lifetime_card_granted BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','churned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON mukti.referrals_v4(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON mukti.referrals_v4(referred_id);
ALTER TABLE mukti.referrals_v4 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referrals_self" ON mukti.referrals_v4;
CREATE POLICY "referrals_self" ON mukti.referrals_v4 FOR SELECT TO authenticated USING (referrer_id = mukti.current_profile_id() OR referred_id = mukti.current_profile_id());

-- ============================================================
-- 6. ambassador_tiers — 8 paliers (seed)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ambassador_tiers (
  slug TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  threshold_conversions INTEGER NOT NULL,
  commission_rate_pct INTEGER NOT NULL,
  plan_granted TEXT,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ordinal INTEGER NOT NULL UNIQUE
);
ALTER TABLE mukti.ambassador_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tiers_public_read" ON mukti.ambassador_tiers;
CREATE POLICY "tiers_public_read" ON mukti.ambassador_tiers FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 7. ambassadeur_profiles — Statut ambassadeur par user
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ambassadeur_profiles (
  user_id UUID PRIMARY KEY REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  tier_slug TEXT NOT NULL DEFAULT 'bronze' REFERENCES mukti.ambassador_tiers(slug),
  conversions_count INTEGER NOT NULL DEFAULT 0,
  total_earned_cents INTEGER NOT NULL DEFAULT 0,
  plan_granted TEXT,
  approved_at TIMESTAMPTZ,
  bio TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE mukti.ambassadeur_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ambassadeur_self" ON mukti.ambassadeur_profiles;
CREATE POLICY "ambassadeur_self" ON mukti.ambassadeur_profiles FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());
DROP POLICY IF EXISTS "ambassadeur_public_count" ON mukti.ambassadeur_profiles;
CREATE POLICY "ambassadeur_public_count" ON mukti.ambassadeur_profiles FOR SELECT TO anon, authenticated USING (approved_at IS NOT NULL);

-- ============================================================
-- 8. commissions — Commissions à payer (parrainage + ambassadeur)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  type TEXT NOT NULL CHECK (type IN ('n1_abo','recurring','ambassador')),
  source_payment_id UUID REFERENCES mukti.payments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','credited','paid')),
  credited_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commissions_user ON mukti.commissions(user_id, created_at DESC);
ALTER TABLE mukti.commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commissions_self" ON mukti.commissions;
CREATE POLICY "commissions_self" ON mukti.commissions FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());

-- ============================================================
-- 9. contests_karma — Concours hebdo/mensuel/annuel + OTS proof
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.contests_karma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL CHECK (period IN ('weekly','monthly','annual')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  pool_cents INTEGER NOT NULL DEFAULT 0,
  rules_pdf_url TEXT,
  ots_proof_url TEXT,
  ots_sha256 TEXT,
  winners_count INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','closed','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  UNIQUE(period, start_at)
);
CREATE INDEX IF NOT EXISTS idx_contests_period ON mukti.contests_karma(period, status);
ALTER TABLE mukti.contests_karma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contests_public_read" ON mukti.contests_karma;
CREATE POLICY "contests_public_read" ON mukti.contests_karma FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 10. contest_entries — Participations + winners
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.contest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES mukti.contests_karma(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  prize_cents INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contest_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_entries_contest_rank ON mukti.contest_entries(contest_id, rank NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_entries_user ON mukti.contest_entries(user_id);
ALTER TABLE mukti.contest_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entries_public_winners" ON mukti.contest_entries;
CREATE POLICY "entries_public_winners" ON mukti.contest_entries FOR SELECT TO anon, authenticated USING (rank IS NOT NULL AND rank <= 10);
DROP POLICY IF EXISTS "entries_self" ON mukti.contest_entries;
CREATE POLICY "entries_self" ON mukti.contest_entries FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());

-- ============================================================
-- 11. stripe_connect_accounts — KYC pour retrait wallet
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.stripe_connect_accounts (
  user_id UUID PRIMARY KEY REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE NOT NULL,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','verified','rejected')),
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  country TEXT DEFAULT 'FR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE mukti.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "connect_self" ON mukti.stripe_connect_accounts;
CREATE POLICY "connect_self" ON mukti.stripe_connect_accounts FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());

-- ============================================================
-- 12. withdrawals_karma — Retraits IBAN via Connect
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.withdrawals_karma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 500),
  stripe_transfer_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON mukti.withdrawals_karma(user_id, requested_at DESC);
ALTER TABLE mukti.withdrawals_karma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "withdrawals_self" ON mukti.withdrawals_karma;
CREATE POLICY "withdrawals_self" ON mukti.withdrawals_karma FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());

-- ============================================================
-- 13. fiscal_profiles — 4 profils détectés par heuristique
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.fiscal_profiles (
  user_id UUID PRIMARY KEY REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL DEFAULT 'particulier' CHECK (profile_type IN ('particulier','micro_bic','societe_is','association')),
  siret TEXT,
  siren TEXT,
  legal_name TEXT,
  override_manual BOOLEAN NOT NULL DEFAULT false,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE mukti.fiscal_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal_profiles_self" ON mukti.fiscal_profiles;
CREATE POLICY "fiscal_profiles_self" ON mukti.fiscal_profiles FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());

-- ============================================================
-- 14. fiscal_declarations — PDF annuels générés
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.fiscal_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 2025 AND 2100),
  total_earned_cents INTEGER NOT NULL DEFAULT 0,
  profile_type TEXT NOT NULL,
  pdf_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_decl_user ON mukti.fiscal_declarations(user_id, year DESC);
ALTER TABLE mukti.fiscal_declarations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal_decl_self" ON mukti.fiscal_declarations;
CREATE POLICY "fiscal_decl_self" ON mukti.fiscal_declarations FOR SELECT TO authenticated USING (user_id = mukti.current_profile_id());

-- ============================================================
-- 15. magic_moments — Feed Wealth Engine anonymisé
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.magic_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'signup','first_payment','streak_7d','streak_30d','streak_100d',
    'addiction_freed','circle_joined','referral_success','ambassador_upgrade',
    'ritual_7s_completed','aurora_completed','core_event_joined','contest_winner'
  )),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_magic_created ON mukti.magic_moments(created_at DESC);
ALTER TABLE mukti.magic_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "magic_public_read" ON mukti.magic_moments;
CREATE POLICY "magic_public_read" ON mukti.magic_moments FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 16. Extension profiles (colonnes manquantes G7)
-- ============================================================
ALTER TABLE mukti.profiles ADD COLUMN IF NOT EXISTS current_plan_slug TEXT;
ALTER TABLE mukti.profiles ADD COLUMN IF NOT EXISTS is_ambassador BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mukti.profiles ADD COLUMN IF NOT EXISTS lifetime_card_granted BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 17. Triggers updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_subs_updated ON mukti.subscriptions;
CREATE TRIGGER trig_subs_updated BEFORE UPDATE ON mukti.subscriptions
  FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();

DROP TRIGGER IF EXISTS trig_ambassadeur_updated ON mukti.ambassadeur_profiles;
CREATE TRIGGER trig_ambassadeur_updated BEFORE UPDATE ON mukti.ambassadeur_profiles
  FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();

DROP TRIGGER IF EXISTS trig_connect_updated ON mukti.stripe_connect_accounts;
CREATE TRIGGER trig_connect_updated BEFORE UPDATE ON mukti.stripe_connect_accounts
  FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();

DROP TRIGGER IF EXISTS trig_fiscal_updated ON mukti.fiscal_profiles;
CREATE TRIGGER trig_fiscal_updated BEFORE UPDATE ON mukti.fiscal_profiles
  FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();

-- ============================================================
-- 18. Seeds — 8 ambassador_tiers + 3 promos
-- ============================================================
INSERT INTO mukti.ambassador_tiers (slug, name_fr, name_en, threshold_conversions, commission_rate_pct, plan_granted, perks, ordinal) VALUES
  ('bronze',  'Bronze',  'Bronze',   10,   10, 'main_monthly', '["Plan Essentiel gratuit à vie","Kit créateur","Badge Bronze"]'::jsonb, 1),
  ('argent',  'Argent',  'Silver',   25,   11, 'main_monthly', '["Plan Essentiel gratuit","Early access 7j","Niveau 2 Academy"]'::jsonb, 2),
  ('or',      'Or',      'Gold',     50,   12, 'main_annual',  '["Plan Annuel gratuit","Page perso","Événements prioritaires"]'::jsonb, 3),
  ('platine', 'Platine', 'Platinum', 100,  13, 'main_annual',  '["Plan Annuel gratuit","Feature priority","Événements VIP"]'::jsonb, 4),
  ('diamant', 'Diamant', 'Diamond',  250,  15, 'main_annual',  '["Retraites annuelles","Accès VIP complet","Mentorat dédié"]'::jsonb, 5),
  ('legende', 'Légende', 'Legend',   500,  17, 'main_annual',  '["Beta exclusive","Commissions héréditaires","Voix comité"]'::jsonb, 6),
  ('titan',   'Titan',   'Titan',    5000, 20, 'main_annual',  '["Ligne produit nominative","Revenue share","Partenariat stratégique"]'::jsonb, 7),
  ('eternel', 'Éternel', 'Eternal',  10000,25, 'main_annual',  '["1% parts distribuées","Héréditaire","Cofondateur honoraire"]'::jsonb, 8)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO mukti.promos (code, label, discount_type, discount_value, duration, duration_in_months, active) VALUES
  ('WELCOME10',    '-10% premier mois',      'percent', 10, 'once',      NULL, true),
  ('ANNUAL30',     '-33% sur le plan annuel','percent', 33, 'once',      NULL, true),
  ('INFLUENCEUR50','-50% premier mois (ambassadeur)', 'percent', 50, 'repeating', 1, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 19. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';

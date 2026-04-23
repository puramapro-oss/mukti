-- ============================================================
-- MUKTI — Schema P1 Foundation
-- Schema: mukti
-- Pattern: profiles.auth_user_id (UUID FK → auth.users.id)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS mukti;
SET search_path TO mukti, public;

-- Extensions (in extensions schema, available globally)
-- gen_random_uuid is available via pgcrypto

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
  subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'premium', 'infini')),
  subscription_status TEXT DEFAULT 'inactive',
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  anti_churn_lifetime_price_cents INTEGER,
  referral_code TEXT UNIQUE,
  referred_by UUID,
  wallet_balance_cents INTEGER NOT NULL DEFAULT 0,
  purama_points INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  awakening_level INTEGER NOT NULL DEFAULT 1,
  affirmations_seen INTEGER NOT NULL DEFAULT 0,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  preferred_locale TEXT DEFAULT 'fr',
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  tutorial_completed BOOLEAN NOT NULL DEFAULT false,
  disclaimer_accepted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON mukti.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON mukti.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON mukti.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON mukti.profiles(stripe_customer_id);

-- ============================================================
-- TABLE: referral_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'ambassadeur', 'partner', 'cross_promo')),
  uses_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON mukti.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON mukti.referral_codes(code);

-- ============================================================
-- TABLE: referrals
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  code_used TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'subscribed', 'churned')),
  first_commission_paid BOOLEAN NOT NULL DEFAULT false,
  recurring_commission_total_cents INTEGER NOT NULL DEFAULT 0,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subscribed_at TIMESTAMPTZ,
  churned_at TIMESTAMPTZ,
  UNIQUE(referrer_user_id, referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON mukti.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON mukti.referrals(referred_user_id);

-- ============================================================
-- TABLE: wallets (1:1 with profiles, kept separate for audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  pending_cents INTEGER NOT NULL DEFAULT 0,
  withdrawal_locked_until TIMESTAMPTZ,
  total_earned_cents INTEGER NOT NULL DEFAULT 0,
  total_withdrawn_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: wallet_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  source TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  stripe_transfer_id TEXT,
  opentimestamps_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON mukti.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON mukti.wallet_transactions(created_at DESC);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON mukti.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON mukti.notifications(created_at DESC);

-- ============================================================
-- TABLE: support_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category TEXT,
  ai_response TEXT,
  ai_resolved BOOLEAN NOT NULL DEFAULT false,
  human_response TEXT,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON mukti.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON mukti.support_tickets(status);

-- ============================================================
-- TABLE: support_escalations (escalated to human)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.support_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES mukti.support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  app_slug TEXT NOT NULL DEFAULT 'mukti',
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_support_escalations_ticket ON mukti.support_escalations(ticket_id);

-- ============================================================
-- TABLE: affirmations (banque universelle conscientes)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.affirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('abondance', 'amour-soi', 'amour', 'confiance', 'liberation-addictions', 'guerison-emotionnelle', 'sommeil-reparateur', 'manifestation', 'protection', 'paix', 'gratitude', 'sagesse')),
  text_fr TEXT NOT NULL,
  text_en TEXT,
  text_es TEXT,
  text_de TEXT,
  text_pt TEXT,
  text_ar TEXT,
  text_zh TEXT,
  text_ja TEXT,
  voice_url TEXT,
  frequency_weight INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'purama' CHECK (source IN ('purama', 'user', 'community')),
  created_by UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affirmations_category_active ON mukti.affirmations(category) WHERE active = true;

-- ============================================================
-- TABLE: awakening_events
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.awakening_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  xp_gained INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_awakening_user_id ON mukti.awakening_events(user_id);

-- ============================================================
-- TABLE: gratitude_entries (journal gratitude quotidien)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.gratitude_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tagged_user_id UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_gratitude_user_date ON mukti.gratitude_entries(user_id, entry_date DESC);

-- ============================================================
-- TABLE: intentions (intention quotidienne)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT,
  intention_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fulfilled BOOLEAN NOT NULL DEFAULT false,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, intention_date)
);
CREATE INDEX IF NOT EXISTS idx_intentions_user_date ON mukti.intentions(user_id, intention_date DESC);

-- ============================================================
-- TABLE: breath_sessions (AURORA OMEGA + autres respirations)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.breath_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  variant TEXT NOT NULL DEFAULT 'aurora-calm' CHECK (variant IN ('aurora-calm', 'aurora-focus', 'aurora-sleep', 'aurora-ignite', 'box', 'wim-hof', '4-7-8')),
  duration_s INTEGER NOT NULL,
  phase_completed INTEGER NOT NULL DEFAULT 0,
  coherence_score INTEGER CHECK (coherence_score BETWEEN 0 AND 100),
  level TEXT CHECK (level IN ('brume', 'onde', 'aura', 'polaris')),
  power_mode TEXT CHECK (power_mode IN ('soft', 'core', 'omega')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_breath_user_id ON mukti.breath_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_breath_started ON mukti.breath_sessions(started_at DESC);

-- ============================================================
-- TABLE: cross_promos (cross-app ecosystem)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.cross_promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app TEXT NOT NULL DEFAULT 'mukti',
  target_app TEXT NOT NULL,
  user_id UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  coupon_code TEXT,
  discount_percent INTEGER,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cross_promos_user ON mukti.cross_promos(user_id);

-- ============================================================
-- TABLE: purama_points (sub-balance separate from cents wallet)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.purama_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: point_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_point_tx_user ON mukti.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_tx_created ON mukti.point_transactions(created_at DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Updated_at trigger (generic)
CREATE OR REPLACE FUNCTION mukti.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_updated_at') THEN
    CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON mukti.profiles FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wallets_updated_at') THEN
    CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON mukti.wallets FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'purama_points_updated_at') THEN
    CREATE TRIGGER purama_points_updated_at BEFORE UPDATE ON mukti.purama_points FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
END $$;

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION mukti.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_referral_code TEXT;
  is_super BOOLEAN;
BEGIN
  is_super := (NEW.email = 'matiss.frasne@gmail.com');
  new_referral_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO mukti.profiles (
    auth_user_id,
    email,
    full_name,
    role,
    subscription_plan,
    referral_code,
    disclaimer_accepted_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN is_super THEN 'super_admin' ELSE 'user' END,
    CASE WHEN is_super THEN 'premium' ELSE 'free' END,
    new_referral_code,
    NULL
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  -- Init wallet + points + referral_code rows for the new profile
  INSERT INTO mukti.wallets (user_id)
    SELECT id FROM mukti.profiles WHERE auth_user_id = NEW.id
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO mukti.purama_points (user_id)
    SELECT id FROM mukti.profiles WHERE auth_user_id = NEW.id
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO mukti.referral_codes (user_id, code, source)
    SELECT id, new_referral_code, 'user' FROM mukti.profiles WHERE auth_user_id = NEW.id
    ON CONFLICT (code) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'mukti_on_auth_user_created') THEN
    CREATE TRIGGER mukti_on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION mukti.handle_new_user();
  END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE mukti.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.support_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.affirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.awakening_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.gratitude_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.breath_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.cross_promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.purama_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.point_transactions ENABLE ROW LEVEL SECURITY;

-- Helper: fetch profile.id from auth.uid()
CREATE OR REPLACE FUNCTION mukti.current_profile_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT id FROM mukti.profiles WHERE auth_user_id = auth.uid() LIMIT 1; $$;

-- profiles: user reads/updates own profile
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON mukti.profiles FOR SELECT USING (auth_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON mukti.profiles FOR UPDATE USING (auth_user_id = auth.uid());
  END IF;
END $$;

-- referral_codes: user reads own + everyone reads to validate code
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='referral_codes' AND policyname='referral_codes_read_all') THEN
    CREATE POLICY referral_codes_read_all ON mukti.referral_codes FOR SELECT USING (active = true);
  END IF;
END $$;

-- referrals: user reads own (as referrer or referred)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='referrals' AND policyname='referrals_read_own') THEN
    CREATE POLICY referrals_read_own ON mukti.referrals FOR SELECT USING (
      referrer_user_id = mukti.current_profile_id() OR referred_user_id = mukti.current_profile_id()
    );
  END IF;
END $$;

-- wallets: user reads/updates own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='wallets' AND policyname='wallets_read_own') THEN
    CREATE POLICY wallets_read_own ON mukti.wallets FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- wallet_transactions: user reads own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='wallet_transactions' AND policyname='wallet_tx_read_own') THEN
    CREATE POLICY wallet_tx_read_own ON mukti.wallet_transactions FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- notifications: user reads own + updates read_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='notifications' AND policyname='notifications_read_own') THEN
    CREATE POLICY notifications_read_own ON mukti.notifications FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='notifications' AND policyname='notifications_update_own') THEN
    CREATE POLICY notifications_update_own ON mukti.notifications FOR UPDATE USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- support_tickets: user reads/inserts own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='support_tickets' AND policyname='support_tickets_rw_own') THEN
    CREATE POLICY support_tickets_rw_own ON mukti.support_tickets FOR ALL USING (user_id = mukti.current_profile_id() OR user_id IS NULL);
  END IF;
END $$;

-- support_escalations: same
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='support_escalations' AND policyname='support_escalations_rw_own') THEN
    CREATE POLICY support_escalations_rw_own ON mukti.support_escalations FOR ALL USING (user_id = mukti.current_profile_id() OR user_id IS NULL);
  END IF;
END $$;

-- affirmations: everyone reads active
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='affirmations' AND policyname='affirmations_read_all') THEN
    CREATE POLICY affirmations_read_all ON mukti.affirmations FOR SELECT USING (active = true);
  END IF;
END $$;

-- awakening_events: user reads/inserts own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='awakening_events' AND policyname='awakening_events_rw_own') THEN
    CREATE POLICY awakening_events_rw_own ON mukti.awakening_events FOR ALL USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- gratitude_entries: user reads/writes own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='gratitude_entries' AND policyname='gratitude_rw_own') THEN
    CREATE POLICY gratitude_rw_own ON mukti.gratitude_entries FOR ALL USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- intentions: user reads/writes own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='intentions' AND policyname='intentions_rw_own') THEN
    CREATE POLICY intentions_rw_own ON mukti.intentions FOR ALL USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- breath_sessions: user reads/writes own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='breath_sessions' AND policyname='breath_rw_own') THEN
    CREATE POLICY breath_rw_own ON mukti.breath_sessions FOR ALL USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- cross_promos: user reads own + active
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='cross_promos' AND policyname='cross_promos_read_own') THEN
    CREATE POLICY cross_promos_read_own ON mukti.cross_promos FOR SELECT USING (user_id = mukti.current_profile_id() OR user_id IS NULL);
  END IF;
END $$;

-- purama_points: user reads own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='purama_points' AND policyname='purama_points_read_own') THEN
    CREATE POLICY purama_points_read_own ON mukti.purama_points FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- point_transactions: user reads own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='point_transactions' AND policyname='point_tx_read_own') THEN
    CREATE POLICY point_tx_read_own ON mukti.point_transactions FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- ============================================================
-- GRANTS for PostgREST roles (anon, authenticated, service_role)
-- ============================================================
GRANT USAGE ON SCHEMA mukti TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mukti TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA mukti TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mukti TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA mukti GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mukti GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mukti GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ============================================================
-- SEED — 14 affirmations base par catégorie (à enrichir P3 via content-agent)
-- ============================================================

INSERT INTO mukti.affirmations (category, text_fr, text_en, source) VALUES
  ('abondance', 'Tu es soutenu·e dans la vie.', 'You are supported in life.', 'purama'),
  ('abondance', 'L''abondance circule librement vers toi.', 'Abundance flows freely toward you.', 'purama'),
  ('amour-soi', 'Tu peux être exactement comme tu es. C''est déjà suffisant.', 'You can be exactly as you are. It is already enough.', 'purama'),
  ('amour-soi', 'Ton corps est un allié, pas un ennemi.', 'Your body is an ally, not an enemy.', 'purama'),
  ('liberation-addictions', 'À chaque respiration, tu te libères un peu plus.', 'With each breath, you free yourself a little more.', 'purama'),
  ('liberation-addictions', 'Tu as toujours le choix de revenir à toi-même.', 'You always have the choice to return to yourself.', 'purama'),
  ('paix', 'Le calme est ta vraie nature.', 'Calm is your true nature.', 'purama'),
  ('paix', 'Tu peux poser ce qui pèse, juste pour cet instant.', 'You can set down what weighs on you, just for this moment.', 'purama'),
  ('confiance', 'Tu sais déjà ce qui est juste pour toi.', 'You already know what is right for you.', 'purama'),
  ('gratitude', 'Merci pour ce souffle. Merci pour cet instant.', 'Thank you for this breath. Thank you for this moment.', 'purama'),
  ('manifestation', 'Ce que tu portes en intention prend déjà racine.', 'What you carry as intention is already taking root.', 'purama'),
  ('protection', 'Tu es entouré·e de présences bienveillantes.', 'You are surrounded by benevolent presences.', 'purama'),
  ('guerison-emotionnelle', 'Tes émotions sont des messagères, pas des prisons.', 'Your emotions are messengers, not prisons.', 'purama'),
  ('sommeil-reparateur', 'Tu peux confier ta journée à la nuit.', 'You can entrust your day to the night.', 'purama')
ON CONFLICT DO NOTHING;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

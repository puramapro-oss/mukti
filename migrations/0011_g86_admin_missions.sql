-- MUKTI G8.6 — Admin god-mode : table missions + nouveaux admin_settings
-- (admin_settings, admin_audit_log, promos, commissions déjà existants G7+G8)

SET search_path TO mukti, public;

-- ============================================================================
-- TABLE mukti.missions — admin CRUD complet
-- ============================================================================

CREATE TABLE IF NOT EXISTS mukti.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_fr TEXT,
  description_en TEXT,
  type TEXT NOT NULL CHECK (type IN ('action','share','referral','meditation','community','other')),
  category TEXT,
  reward_points INTEGER NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  reward_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (reward_amount_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missions_active ON mukti.missions(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_missions_type ON mukti.missions(type);

ALTER TABLE mukti.missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "missions_read_active" ON mukti.missions;
CREATE POLICY "missions_read_active" ON mukti.missions
  FOR SELECT USING (active = TRUE OR EXISTS (
    SELECT 1 FROM mukti.profiles p
    WHERE p.id = mukti.current_profile_id() AND p.role = 'super_admin'
  ));

DROP POLICY IF EXISTS "missions_super_admin_write" ON mukti.missions;
CREATE POLICY "missions_super_admin_write" ON mukti.missions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mukti.profiles p WHERE p.id = mukti.current_profile_id() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM mukti.profiles p WHERE p.id = mukti.current_profile_id() AND p.role = 'super_admin')
  );

CREATE OR REPLACE FUNCTION mukti.missions_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS missions_updated_at ON mukti.missions;
CREATE TRIGGER missions_updated_at
  BEFORE UPDATE ON mukti.missions
  FOR EACH ROW
  EXECUTE FUNCTION mukti.missions_set_updated_at();

-- ============================================================================
-- SEEDS — 6 missions starter (tout active)
-- ============================================================================

INSERT INTO mukti.missions (slug, title_fr, title_en, description_fr, description_en, type, category, reward_points, sort_order) VALUES
  ('first_signup', 'Bienvenue dans MUKTI', 'Welcome to MUKTI', 'Crée ton compte et reçois une première étincelle.', 'Create your account and receive your first spark.', 'action', 'onboarding', 50, 10),
  ('first_meditation', 'Première méditation', 'First meditation', 'Termine ta première session AURORA OMEGA.', 'Complete your first AURORA OMEGA session.', 'meditation', 'aurora', 30, 20),
  ('first_circle_join', 'Rejoindre un cercle', 'Join a circle', 'Participe à un cercle d''intention collectif.', 'Join a collective intention circle.', 'community', 'cercles', 40, 30),
  ('refer_one_friend', 'Parrainer un proche', 'Refer one friend', 'Invite quelqu''un que tu aimes à rejoindre MUKTI.', 'Invite someone you love to join MUKTI.', 'referral', 'parrainage', 100, 40),
  ('share_story', 'Partager ton histoire', 'Share your story', 'Témoigne sur le mur des accompagnants.', 'Share on the companions wall.', 'share', 'accompagnants', 60, 50),
  ('weekly_ritual', 'Rituel hebdomadaire', 'Weekly ritual', 'Rejoins le rituel collectif de la semaine.', 'Join this week''s collective ritual.', 'community', 'rituel', 70, 60)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- ADMIN_SETTINGS — nouveaux defaults : pricing_main_annual_cents + wording_bank
-- ============================================================================

INSERT INTO mukti.admin_settings (key, value, description) VALUES
  ('pricing_main_annual_cents', '7990'::jsonb, 'Prix abonnement annuel en centimes (-33% vs mensuel ×12)'),
  ('wording_bank', '{"greetings":{},"errors":{},"success":{},"cta":{},"faq":{},"meta":{}}'::jsonb, 'Bank wording structurée — 6 sections (greetings, errors, success, cta, faq, meta)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- PostgREST reload
-- ============================================================================

NOTIFY pgrst, 'reload schema';

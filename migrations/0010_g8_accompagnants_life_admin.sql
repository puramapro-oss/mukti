-- MUKTI G8 — Migration 0010
-- 11 tables : Espace Accompagnants + Fil de Vie + Rituel Hebdo + Admin + Q&R + Emergency
-- Schema: mukti. RLS activé partout. Seeds : 7 rituels + emergency resources 10 pays.

SET search_path TO mukti, public;

-- ============================================================================
-- 1) ACCOMPAGNANTS — profils + ressources + témoignages
-- ============================================================================

CREATE TABLE IF NOT EXISTS mukti.accompagnants_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lien_avec_malade TEXT NOT NULL CHECK (lien_avec_malade IN ('parent','conjoint','enfant','ami','soignant','autre')),
  situation TEXT,
  energy_level SMALLINT DEFAULT 50 CHECK (energy_level BETWEEN 0 AND 100),
  consent_shared_stories BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mukti.accompagnants_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_slug TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_md_fr TEXT NOT NULL,
  content_md_en TEXT,
  video_url TEXT,
  audio_url TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accomp_resources_section ON mukti.accompagnants_resources(section_slug, active, display_order);

CREATE TABLE IF NOT EXISTS mukti.accompagnants_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  anonymous BOOLEAN DEFAULT TRUE,
  approved BOOLEAN DEFAULT FALSE,
  moderation_score REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accomp_testimonials_approved ON mukti.accompagnants_testimonials(approved, created_at DESC);

-- ============================================================================
-- 2) FIL DE VIE — timeline + projections
-- ============================================================================

CREATE TABLE IF NOT EXISTS mukti.life_feed_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label_fr TEXT NOT NULL,
  label_en TEXT,
  value_cents INTEGER,
  country_code TEXT,
  geo_lat REAL,
  geo_lng REAL,
  source_table TEXT,
  source_id UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_feed_user ON mukti.life_feed_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_life_feed_country ON mukti.life_feed_entries(country_code) WHERE country_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_life_feed_kind ON mukti.life_feed_entries(kind);

CREATE TABLE IF NOT EXISTS mukti.life_feed_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  horizon_years SMALLINT NOT NULL CHECK (horizon_years IN (5,10,20)),
  projected_impact JSONB NOT NULL,
  summary_fr TEXT,
  summary_en TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projections_user ON mukti.life_feed_projections(user_id, horizon_years);

-- ============================================================================
-- 3) RITUEL HEBDO TOURNANT 7 SEMAINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS mukti.rituel_hebdo_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_iso TEXT NOT NULL UNIQUE,
  theme_slug TEXT NOT NULL CHECK (theme_slug IN ('depolluer','paix','amour','pardon','gratitude','abondance','conscience')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  participants_count INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rituel_weeks_starts ON mukti.rituel_hebdo_weeks(starts_at DESC);

CREATE TABLE IF NOT EXISTS mukti.rituel_hebdo_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_iso TEXT NOT NULL REFERENCES mukti.rituel_hebdo_weeks(week_iso) ON DELETE CASCADE,
  minutes_practiced INTEGER DEFAULT 0,
  intention_text TEXT,
  shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_iso)
);

CREATE INDEX IF NOT EXISTS idx_rituel_participations_week ON mukti.rituel_hebdo_participations(week_iso, created_at);

-- ============================================================================
-- 4) ADMIN SETTINGS + AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS mukti.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mukti.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  before_value JSONB,
  after_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON mukti.admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON mukti.admin_audit_log(target_table, target_id);

-- ============================================================================
-- 5) Q&R CONVERSATIONS + EMERGENCY RESOURCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS mukti.qa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  context_page TEXT,
  lang TEXT DEFAULT 'fr',
  distress_score REAL,
  escalated BOOLEAN DEFAULT FALSE,
  country_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_user ON mukti.qa_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_escalated ON mukti.qa_conversations(escalated, created_at DESC) WHERE escalated = TRUE;

CREATE TABLE IF NOT EXISTS mukti.emergency_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('suicide','addiction','violence','mental_health','general')),
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  phone TEXT,
  url TEXT,
  hours_fr TEXT,
  hours_en TEXT,
  description_fr TEXT,
  description_en TEXT,
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_country_cat ON mukti.emergency_resources(country_code, category, active, priority DESC);

-- ============================================================================
-- TRIGGERS — updated_at auto
-- ============================================================================

CREATE OR REPLACE FUNCTION mukti.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accomp_profiles_updated ON mukti.accompagnants_profiles;
CREATE TRIGGER trg_accomp_profiles_updated BEFORE UPDATE ON mukti.accompagnants_profiles
  FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_settings_updated ON mukti.admin_settings;
CREATE TRIGGER trg_admin_settings_updated BEFORE UPDATE ON mukti.admin_settings
  FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();

-- ============================================================================
-- RLS — self-only + super_admin bypass
-- ============================================================================

ALTER TABLE mukti.accompagnants_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accomp_profiles_self" ON mukti.accompagnants_profiles;
CREATE POLICY "accomp_profiles_self" ON mukti.accompagnants_profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE mukti.accompagnants_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accomp_resources_public_read" ON mukti.accompagnants_resources;
CREATE POLICY "accomp_resources_public_read" ON mukti.accompagnants_resources
  FOR SELECT USING (active = TRUE);

ALTER TABLE mukti.accompagnants_testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accomp_testimonials_approved_read" ON mukti.accompagnants_testimonials;
CREATE POLICY "accomp_testimonials_approved_read" ON mukti.accompagnants_testimonials
  FOR SELECT USING (approved = TRUE);
DROP POLICY IF EXISTS "accomp_testimonials_insert_self" ON mukti.accompagnants_testimonials;
CREATE POLICY "accomp_testimonials_insert_self" ON mukti.accompagnants_testimonials
  FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER TABLE mukti.life_feed_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "life_feed_self" ON mukti.life_feed_entries;
CREATE POLICY "life_feed_self" ON mukti.life_feed_entries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE mukti.life_feed_projections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "life_projections_self" ON mukti.life_feed_projections;
CREATE POLICY "life_projections_self" ON mukti.life_feed_projections
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE mukti.rituel_hebdo_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rituel_weeks_public_read" ON mukti.rituel_hebdo_weeks;
CREATE POLICY "rituel_weeks_public_read" ON mukti.rituel_hebdo_weeks
  FOR SELECT USING (TRUE);

ALTER TABLE mukti.rituel_hebdo_participations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rituel_part_self" ON mukti.rituel_hebdo_participations;
CREATE POLICY "rituel_part_self" ON mukti.rituel_hebdo_participations
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE mukti.admin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_settings_super_admin" ON mukti.admin_settings;
CREATE POLICY "admin_settings_super_admin" ON mukti.admin_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mukti.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

ALTER TABLE mukti.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_super_admin" ON mukti.admin_audit_log;
CREATE POLICY "admin_audit_super_admin" ON mukti.admin_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mukti.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

ALTER TABLE mukti.qa_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qa_conversations_self" ON mukti.qa_conversations;
CREATE POLICY "qa_conversations_self" ON mukti.qa_conversations
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE mukti.emergency_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emergency_public_read" ON mukti.emergency_resources;
CREATE POLICY "emergency_public_read" ON mukti.emergency_resources
  FOR SELECT USING (active = TRUE);

-- ============================================================================
-- SEEDS — 10 sections accompagnants (titres + placeholder content)
-- ============================================================================

INSERT INTO mukti.accompagnants_resources (section_slug, title_fr, title_en, content_md_fr, content_md_en, display_order, active) VALUES
  ('comprendre-le-malade', 'Comprendre le malade', 'Understand the suffering one',
   'Accompagner commence par écouter sans interpréter. Le malade ne cherche pas toujours une solution — il cherche à être vu. Apprends à distinguer son vécu de ta projection.',
   'Accompanying starts with listening without interpreting. The one suffering is not always looking for a solution — they are looking to be seen.',
   1, TRUE),
  ('proteger-ton-energie', 'Protéger ton énergie', 'Protect your energy',
   'Ton énergie n''est pas infinie. Techniques simples : douche mentale après chaque visite, 3 respirations avant d''ouvrir la porte, ancrage 2 min le soir.',
   'Your energy is not infinite. Simple techniques: mental shower after each visit, 3 breaths before opening the door, 2-min grounding at night.',
   2, TRUE),
  ('ne-pas-prendre-sur-toi', 'Ne pas prendre la maladie sur toi', 'Do not take the illness on yourself',
   'Tu accompagnes. Tu n''absorbes pas. La douleur que tu ressens pour l''autre ne guérit pas l''autre — elle te vide toi. Tu peux être présent et garder ta propre lumière.',
   'You accompany. You do not absorb. The pain you feel for the other does not heal them — it depletes you. You can be present and keep your own light.',
   3, TRUE),
  ('apaisement-stress-chronique', 'Apaisement stress chronique de l''aidant', 'Relieving chronic caregiver stress',
   'Le stress chronique s''installe par petites fuites. Cohérence cardiaque 5 min 3×/jour + marche 20 min + sommeil sanctuaire. Ces 3 piliers suffisent à 70%.',
   'Chronic stress installs itself through small leaks. 5-min heart coherence 3×/day + 20-min walk + sanctuary sleep. These 3 pillars cover 70%.',
   4, TRUE),
  ('micro-rituels-2-5min', 'Micro-rituels 2-5 min quotidiens', 'Daily 2-5 min micro-rituals',
   'Dans le couloir avant d''entrer : main sur le cœur, 3 respirations, une phrase — "Je suis là, je ne porte pas sa maladie." 90 secondes.',
   'In the hallway before entering: hand on heart, 3 breaths, one phrase — "I am here, I do not carry their illness." 90 seconds.',
   5, TRUE),
  ('cercles-accompagnants', 'Groupes de parole accompagnants', 'Accompanying support circles',
   'Les Cercles d''Intention dédiés aidants sont accessibles toute la semaine. Parler à d''autres qui vivent la même chose change tout.',
   'Intention Circles dedicated to caregivers are available all week. Speaking to others living the same thing changes everything.',
   6, TRUE),
  ('temoignages-anonymes', 'Témoignages anonymes d''aidants', 'Anonymous caregiver testimonials',
   'Lire les mots d''autres aidants anonymes. Tu n''es pas seul. Beaucoup sont passés par ce que tu traverses — et s''en sont relevés.',
   'Read anonymous caregiver testimonials. You are not alone. Many have gone through what you are experiencing — and have risen.',
   7, TRUE),
  ('outils-communication', 'Outils communication avec le malade', 'Communication tools with the ill person',
   'Questions ouvertes plutôt que fermées. Silence qui accueille. Reformulation douce. Validation émotionnelle avant toute action.',
   'Open questions rather than closed. Welcoming silence. Gentle rephrasing. Emotional validation before any action.',
   8, TRUE),
  ('lacher-prise-sans-culpabilite', 'Savoir lâcher prise sans culpabilité', 'Letting go without guilt',
   'Tu ne peux pas tout. Lâcher n''est pas abandonner. Confier à un soignant, prendre 48h pour toi, accepter de ne pas être parfait.',
   'You cannot do everything. Letting go is not abandoning. Entrusting a professional, taking 48h for yourself, accepting imperfection.',
   9, TRUE),
  ('continuer-a-vivre', 'Continuer à vivre sa meilleure vie', 'Continue living your best life',
   'Ta joie n''insulte pas sa souffrance. Ton rire ne vole rien. Vivre pleinement est la plus belle façon d''honorer celui qui ne peut plus le faire autant.',
   'Your joy does not insult their suffering. Your laughter steals nothing. Living fully is the most beautiful way to honor the one who can no longer do so as much.',
   10, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEEDS — admin_settings initiaux
-- ============================================================================

INSERT INTO mukti.admin_settings (key, value, description) VALUES
  ('vida_angel_active', 'false'::jsonb, 'Mode VIDA ANGEL — si true, rewards multipliés ×2 pour la journée'),
  ('vida_angel_multiplier', '2'::jsonb, 'Multiplicateur VIDA ANGEL (par défaut 2)'),
  ('pricing_main_monthly_cents', '999'::jsonb, 'Prix abonnement mensuel en centimes (live override)'),
  ('pricing_anti_churn_cents', '499'::jsonb, 'Prix anti-churn à vie en centimes'),
  ('feature_flags', '{"ar_mirror":true,"aurora":true,"core_events":true,"fil_de_vie":true,"rituel_hebdo":true}'::jsonb, 'Feature flags par clé → on/off global')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SEEDS — emergency_resources 10 pays
-- ============================================================================

INSERT INTO mukti.emergency_resources (country_code, category, name_fr, name_en, phone, url, hours_fr, hours_en, priority) VALUES
  ('FR', 'suicide', '3114 — Numéro national prévention suicide', '3114 — French national suicide prevention', '3114', 'https://3114.fr', '24h/24 7j/7 gratuit', '24/7 free', 100),
  ('FR', 'addiction', 'Drogues Info Service', 'French Drug Info Service', '0800231313', 'https://drogues-info-service.fr', '8h-2h 7j/7', '8am-2am 7/7', 90),
  ('FR', 'violence', '3919 — Violences femmes info', '3919 — Women violence help', '3919', 'https://solidaritefemmes.org', '24h/24 7j/7', '24/7', 90),
  ('FR', 'general', '15 — SAMU urgences', '15 — Emergency medical', '15', NULL, 'Urgence vitale', 'Life emergency', 100),
  ('US', 'suicide', '988 Suicide & Crisis Lifeline', '988 Suicide & Crisis Lifeline', '988', 'https://988lifeline.org', '24/7 free', '24/7 free', 100),
  ('US', 'addiction', 'SAMHSA National Helpline', 'SAMHSA National Helpline', '18006624357', 'https://samhsa.gov/find-help', '24/7 free', '24/7 free', 90),
  ('GB', 'suicide', 'Samaritans', 'Samaritans', '116123', 'https://samaritans.org', '24/7 gratuit', '24/7 free', 100),
  ('GB', 'general', '111 NHS', '111 NHS', '111', 'https://nhs.uk/111', '24/7', '24/7', 90),
  ('ES', 'suicide', '024 — Línea Atención a la Conducta Suicida', '024 — Spanish suicide line', '024', NULL, '24/7 gratuito', '24/7 free', 100),
  ('DE', 'suicide', 'TelefonSeelsorge', 'TelefonSeelsorge', '08001110111', 'https://telefonseelsorge.de', '24/7 kostenlos', '24/7 free', 100),
  ('IT', 'suicide', 'Telefono Amico Italia', 'Telefono Amico Italia', '02-2327-2327', 'https://telefonoamico.it', '10h-24h tous les jours', '10am-midnight daily', 100),
  ('PT', 'suicide', 'SOS Voz Amiga', 'SOS Voz Amiga', '213544545', 'https://sosvozamiga.org', '15h30-00h30', '3:30pm-0:30am', 100),
  ('CA', 'suicide', 'Talk Suicide Canada', 'Talk Suicide Canada', '18334564566', 'https://talksuicide.ca', '24/7 gratuit', '24/7 free', 100),
  ('CH', 'suicide', 'La Main Tendue', 'La Main Tendue', '143', 'https://143.ch', '24/7 gratuit', '24/7 free', 100),
  ('BE', 'suicide', 'Centre de Prévention du Suicide', 'Suicide Prevention Center', '0800-32-123', 'https://preventionsuicide.be', '24/7 gratuit', '24/7 free', 100),
  ('JP', 'suicide', 'Yorisoi Hotline', 'Yorisoi Hotline', '0120-279-338', 'https://since2011.net/yorisoi', '24/7 無料', '24/7 free', 100),
  ('CN', 'suicide', 'Beijing Suicide Research & Prevention', 'Beijing Suicide Research & Prevention', '010-82951332', 'http://crisis.org.cn', '24/7 免费', '24/7 free', 100),
  ('INT', 'suicide', 'Findahelpline International', 'Findahelpline International', NULL, 'https://findahelpline.com', 'Disponible partout', 'Available worldwide', 50)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Extension profiles G8 — country_code pour détection détresse
-- ============================================================================

ALTER TABLE mukti.profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS reduced_motion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS high_contrast BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- PostgREST reload
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- Fin migration 0010

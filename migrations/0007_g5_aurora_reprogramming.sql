-- ============================================================
-- MUKTI — G5 AURORA OMEGA + Reprogrammation + 4 modes avancés
-- Migration 0007 : 5 nouvelles tables + RLS + extensions
--   + trigger auto-create aurora_streaks à signup
--   + extension mode_sessions.mode CHECK (4 nouveaux modes)
-- Patterns G1-G4 : schema mukti, user_id → mukti.profiles(id),
-- idempotent IF NOT EXISTS, RLS via mukti.current_profile_id().
-- ============================================================

SET search_path = mukti, public;

-- ============================================================
-- 1. aurora_sessions — historique sessions AURORA OMEGA
--    Une ligne par session démarrée (même si abandonnée)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.aurora_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('calm','focus','sleep','ignite')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 1800),
  phases_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  coherence_score NUMERIC(4,3) CHECK (coherence_score IS NULL OR (coherence_score >= 0 AND coherence_score <= 1)),
  power_switch TEXT CHECK (power_switch IS NULL OR power_switch IN ('soft','core','omega')),
  level_reached TEXT CHECK (level_reached IS NULL OR level_reached IN ('brume','onde','aura','polaris')),
  stopped_reason TEXT CHECK (stopped_reason IS NULL OR stopped_reason IN ('user_stop','dizzy','glide_out_complete','timeout','error')),
  voice_guidance BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aurora_sessions_user_time ON mukti.aurora_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_aurora_sessions_variant ON mukti.aurora_sessions(variant) WHERE completed_at IS NOT NULL;

-- ============================================================
-- 2. aurora_streaks — 1 ligne par user, évolution niveau Brume→Polaris
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.aurora_streaks (
  user_id UUID PRIMARY KEY REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  current_days INTEGER NOT NULL DEFAULT 0 CHECK (current_days >= 0),
  best_days INTEGER NOT NULL DEFAULT 0 CHECK (best_days >= 0),
  last_session_date DATE,
  current_level TEXT NOT NULL DEFAULT 'brume' CHECK (current_level IN ('brume','onde','aura','polaris')),
  total_minutes INTEGER NOT NULL DEFAULT 0 CHECK (total_minutes >= 0),
  total_sessions INTEGER NOT NULL DEFAULT 0 CHECK (total_sessions >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. reprogramming_sessions — Mode Nuit + Mode Journée
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.reprogramming_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('night','day')),
  category TEXT NOT NULL CHECK (category IN (
    'abondance','amour-soi','confiance','liberation-addictions',
    'guerison-emotionnelle','sommeil-reparateur','manifestation','protection','paix'
  )),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 28800),
  affirmations_played UUID[] NOT NULL DEFAULT '{}',
  affirmations_count INTEGER NOT NULL DEFAULT 0 CHECK (affirmations_count >= 0),
  nature_sound TEXT NOT NULL DEFAULT 'silence' CHECK (nature_sound IN ('foret','riviere','vent','pluie','ocean','silence')),
  volume_profile TEXT NOT NULL DEFAULT 'adaptive' CHECK (volume_profile IN ('adaptive','fixed')),
  voice_guidance BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reprog_user_time ON mukti.reprogramming_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reprog_mode_cat ON mukti.reprogramming_sessions(mode, category);

-- ============================================================
-- 4. boite_noire_entries — déclencheurs addictions capturés
--    Pas de GPS brut, juste 6 location presets (RGPD)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.boite_noire_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  addiction_id UUID NOT NULL REFERENCES mukti.addictions(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location_hint TEXT CHECK (location_hint IS NULL OR location_hint IN (
    'maison','bureau','transport','cafe_bar','exterieur','autre'
  )),
  who_context TEXT CHECK (who_context IS NULL OR who_context IN (
    'seul','famille','collegues','ami','partenaire','inconnu'
  )),
  what_trigger TEXT NOT NULL CHECK (length(what_trigger) BETWEEN 2 AND 500),
  emotion TEXT CHECK (emotion IS NULL OR length(emotion) BETWEEN 1 AND 30),
  intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
  resisted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boite_user_addiction ON mukti.boite_noire_entries(user_id, addiction_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_boite_intensity ON mukti.boite_noire_entries(user_id, intensity);

-- ============================================================
-- 5. affirmation_custom — affirmations perso créées par user
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.affirmation_custom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'abondance','amour-soi','confiance','liberation-addictions',
    'guerison-emotionnelle','sommeil-reparateur','manifestation','protection','paix'
  )),
  text_user TEXT NOT NULL CHECK (length(text_user) BETWEEN 5 AND 300),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, text_user)
);
CREATE INDEX IF NOT EXISTS idx_custom_user_cat ON mukti.affirmation_custom(user_id, category) WHERE active = true;

-- ============================================================
-- Extension mode_sessions.mode CHECK — 4 nouveaux modes avancés
--   boucle_urgence | exorcisme | boite_noire | rituel_7s
-- (drop + recreate CHECK — sécurisé par fail-safe sur existant)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='mukti' AND table_name='mode_sessions'
      AND constraint_name='mode_sessions_mode_check'
  ) THEN
    ALTER TABLE mukti.mode_sessions DROP CONSTRAINT mode_sessions_mode_check;
  END IF;

  ALTER TABLE mukti.mode_sessions ADD CONSTRAINT mode_sessions_mode_check
    CHECK (mode IN (
      'coupure_instantanee','multisensoriel_ultime','micro_meditation',
      'avatar_anticraving','compteur_motivation',
      'boucle_urgence','exorcisme','boite_noire','rituel_7s'
    ));
END $$;

-- ============================================================
-- RLS — 5 nouvelles tables
-- ============================================================
ALTER TABLE mukti.aurora_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.aurora_streaks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.reprogramming_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.boite_noire_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.affirmation_custom       ENABLE ROW LEVEL SECURITY;

-- aurora_sessions : user CRUD own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='aurora_sessions' AND policyname='aurora_sessions_rw_own') THEN
    CREATE POLICY aurora_sessions_rw_own ON mukti.aurora_sessions FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- aurora_streaks : user read + update own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='aurora_streaks' AND policyname='aurora_streaks_rw_own') THEN
    CREATE POLICY aurora_streaks_rw_own ON mukti.aurora_streaks FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- reprogramming_sessions : user CRUD own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='reprogramming_sessions' AND policyname='reprog_sessions_rw_own') THEN
    CREATE POLICY reprog_sessions_rw_own ON mukti.reprogramming_sessions FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- boite_noire_entries : user CRUD own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='boite_noire_entries' AND policyname='boite_noire_rw_own') THEN
    CREATE POLICY boite_noire_rw_own ON mukti.boite_noire_entries FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- affirmation_custom : user CRUD own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='affirmation_custom' AND policyname='custom_aff_rw_own') THEN
    CREATE POLICY custom_aff_rw_own ON mukti.affirmation_custom FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- ============================================================
-- Trigger : auto-create aurora_streaks à la création du profil
--   (append sur le trigger existant mukti_on_auth_user_created via fonction complémentaire)
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.ensure_aurora_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mukti, public
AS $$
BEGIN
  INSERT INTO mukti.aurora_streaks (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_aurora_streak ON mukti.profiles;
CREATE TRIGGER profiles_ensure_aurora_streak
  AFTER INSERT ON mukti.profiles
  FOR EACH ROW
  EXECUTE FUNCTION mukti.ensure_aurora_streak();

-- Back-fill pour users existants (idempotent via ON CONFLICT)
INSERT INTO mukti.aurora_streaks (user_id)
SELECT id FROM mukti.profiles
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Trigger : updated_at auto sur aurora_streaks
-- ============================================================
DROP TRIGGER IF EXISTS aurora_streaks_set_updated_at ON mukti.aurora_streaks;
CREATE TRIGGER aurora_streaks_set_updated_at
  BEFORE UPDATE ON mukti.aurora_streaks
  FOR EACH ROW
  EXECUTE FUNCTION mukti.set_updated_at();

-- ============================================================
-- PostgREST exposition
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.aurora_sessions        TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.aurora_streaks         TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.reprogramming_sessions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.boite_noire_entries    TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.affirmation_custom     TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

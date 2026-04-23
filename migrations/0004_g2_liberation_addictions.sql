-- ============================================================
-- MUKTI — G2 Libération Addictions Core
-- Migration 0004 : 8 tables + triggers + RLS + indexes
-- Patterns alignés G1 : schema mukti, user_id → mukti.profiles(id),
-- idempotent IF NOT EXISTS, RLS via mukti.current_profile_id().
-- ============================================================

SET search_path = mukti, public;

-- ============================================================
-- 1. addictions — déclaration user (1..3 actives max par user)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.addictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'tabac','alcool','sucre','drogue','ecran','jeux',
    'reseaux_sociaux','pornographie','achats','nourriture',
    'codependance','travail','autre'
  )),
  severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  frequency_daily SMALLINT,
  started_ago_months SMALLINT,
  triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  goal TEXT NOT NULL DEFAULT 'stop' CHECK (goal IN ('reduce','stop')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','liberated','archived')),
  custom_label TEXT,
  declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  liberated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addictions_user_id ON mukti.addictions(user_id);
CREATE INDEX IF NOT EXISTS idx_addictions_user_active ON mukti.addictions(user_id) WHERE status = 'active';

-- ============================================================
-- 2. programs — programme Opus 4.7 (1 par addiction + versions)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addiction_id UUID NOT NULL REFERENCES mukti.addictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  model_used TEXT NOT NULL DEFAULT 'claude-opus-4-7',
  opus_response JSONB NOT NULL,
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  micro_meditations JSONB NOT NULL DEFAULT '[]'::jsonb,
  affirmations JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_modes JSONB NOT NULL DEFAULT '[]'::jsonb,
  plants_info JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_markers JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_tokens_input INTEGER,
  generation_tokens_output INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_programs_addiction_id ON mukti.programs(addiction_id);
CREATE INDEX IF NOT EXISTS idx_programs_user_id ON mukti.programs(user_id);
CREATE INDEX IF NOT EXISTS idx_programs_current ON mukti.programs(addiction_id) WHERE is_current = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_programs_current_per_addiction ON mukti.programs(addiction_id) WHERE is_current = true;

-- ============================================================
-- 3. streaks — 1 streak actif par addiction
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addiction_id UUID NOT NULL REFERENCES mukti.addictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checkin_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  current_days INTEGER NOT NULL DEFAULT 0,
  best_days INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  end_reason TEXT CHECK (end_reason IN ('relapse','paused','liberated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_streaks_addiction_id ON mukti.streaks(addiction_id);
CREATE INDEX IF NOT EXISTS idx_streaks_user_id ON mukti.streaks(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_streaks_active_per_addiction ON mukti.streaks(addiction_id) WHERE is_active = true;

-- ============================================================
-- 4. relapses — rechutes sans jugement
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.relapses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addiction_id UUID NOT NULL REFERENCES mukti.addictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  streak_id UUID REFERENCES mukti.streaks(id) ON DELETE SET NULL,
  relapsed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_note TEXT,
  mood_before SMALLINT CHECK (mood_before BETWEEN 1 AND 10),
  context_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  streak_reset_from_days INTEGER NOT NULL DEFAULT 0,
  generated_insight TEXT,
  insight_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_relapses_addiction_id ON mukti.relapses(addiction_id);
CREATE INDEX IF NOT EXISTS idx_relapses_user_id ON mukti.relapses(user_id);
CREATE INDEX IF NOT EXISTS idx_relapses_relapsed_at ON mukti.relapses(relapsed_at DESC);

-- ============================================================
-- 5. mode_sessions — usage des 5 modes MVP G2
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.mode_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  addiction_id UUID REFERENCES mukti.addictions(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN (
    'coupure_40s','multisensoriel','micro_meditation','avatar','compteur'
  )),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_sec INTEGER,
  urge_before SMALLINT CHECK (urge_before BETWEEN 1 AND 10),
  urge_after SMALLINT CHECK (urge_after BETWEEN 1 AND 10),
  outcome TEXT CHECK (outcome IN ('resisted','relapsed','interrupted','completed')),
  sensor_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_ip INET,
  client_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mode_sessions_user ON mukti.mode_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mode_sessions_addiction ON mukti.mode_sessions(addiction_id);
CREATE INDEX IF NOT EXISTS idx_mode_sessions_mode ON mukti.mode_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_mode_sessions_started ON mukti.mode_sessions(started_at DESC);

-- ============================================================
-- 6. payment_milestones — J1/J7/J30/J90 wallet par addiction
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  addiction_id UUID NOT NULL REFERENCES mukti.addictions(id) ON DELETE CASCADE,
  streak_id UUID REFERENCES mukti.streaks(id) ON DELETE SET NULL,
  milestone TEXT NOT NULL CHECK (milestone IN ('J1','J7','J30','J90')),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','credited','locked','unlocked','denied_fraud','denied_score'
  )),
  credited_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  unlocked_at TIMESTAMPTZ,
  trust_score_at_grant SMALLINT,
  fraud_check_passed BOOLEAN,
  wallet_tx_locked_id UUID REFERENCES mukti.wallet_transactions(id) ON DELETE SET NULL,
  wallet_tx_unlocked_id UUID REFERENCES mukti.wallet_transactions(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_user ON mukti.payment_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_addiction ON mukti.payment_milestones(addiction_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_status ON mukti.payment_milestones(status);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_unlock ON mukti.payment_milestones(locked_until) WHERE status = 'locked';
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_milestones_triple ON mukti.payment_milestones(user_id, addiction_id, milestone);

-- ============================================================
-- 7. trust_scores — score anti-fraude comportemental (1 par user)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
  coherence_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  multi_account_flags INTEGER NOT NULL DEFAULT 0,
  gps_anomalies INTEGER NOT NULL DEFAULT 0,
  rapid_actions_flags INTEGER NOT NULL DEFAULT 0,
  manual_review_flag BOOLEAN NOT NULL DEFAULT false,
  manual_review_reason TEXT,
  payout_ceiling_cents INTEGER NOT NULL DEFAULT 500,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trust_scores_user_id ON mukti.trust_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_review ON mukti.trust_scores(user_id) WHERE manual_review_flag = true;

-- ============================================================
-- 8. trust_fingerprints — multi-comptes detection
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.trust_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  fingerprint_hash TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trust_fingerprints_hash ON mukti.trust_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_trust_fingerprints_user ON mukti.trust_fingerprints(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trust_fingerprints_user_hash ON mukti.trust_fingerprints(user_id, fingerprint_hash);

-- ============================================================
-- updated_at triggers (utilise mukti.set_updated_at de G1)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'addictions_updated_at') THEN
    CREATE TRIGGER addictions_updated_at BEFORE UPDATE ON mukti.addictions
      FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trust_scores_updated_at') THEN
    CREATE TRIGGER trust_scores_updated_at BEFORE UPDATE ON mukti.trust_scores
      FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
END $$;

-- ============================================================
-- enforce 3 addictions actives max par user
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.enforce_max_active_addictions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT count(*) INTO active_count
      FROM mukti.addictions
      WHERE user_id = NEW.user_id
        AND status = 'active'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF active_count >= 3 THEN
      RAISE EXCEPTION 'MUKTI_MAX_ACTIVE_ADDICTIONS: user % already has 3 active addictions', NEW.user_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'addictions_enforce_max_active') THEN
    CREATE TRIGGER addictions_enforce_max_active
      BEFORE INSERT OR UPDATE ON mukti.addictions
      FOR EACH ROW EXECUTE FUNCTION mukti.enforce_max_active_addictions();
  END IF;
END $$;

-- ============================================================
-- auto-create trust_scores row at profile insert
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.ensure_trust_score_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO mukti.trust_scores (user_id, score, payout_ceiling_cents)
    VALUES (NEW.id, 50, 500)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_ensure_trust_score') THEN
    CREATE TRIGGER profiles_ensure_trust_score
      AFTER INSERT ON mukti.profiles
      FOR EACH ROW EXECUTE FUNCTION mukti.ensure_trust_score_for_profile();
  END IF;
END $$;

-- Backfill trust_scores pour profils existants
INSERT INTO mukti.trust_scores (user_id, score, payout_ceiling_cents)
  SELECT id, 50, 500 FROM mukti.profiles
  ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- on_relapse: ferme streak actuel + ouvre nouveau streak j0
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.handle_relapse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_streak_id UUID;
  current_days_val INTEGER;
BEGIN
  SELECT id, current_days INTO current_streak_id, current_days_val
    FROM mukti.streaks
    WHERE addiction_id = NEW.addiction_id AND is_active = true
    LIMIT 1;

  IF current_streak_id IS NOT NULL THEN
    UPDATE mukti.streaks
      SET is_active = false,
          ended_at = NEW.relapsed_at,
          end_reason = 'relapse',
          best_days = GREATEST(best_days, current_days)
      WHERE id = current_streak_id;

    NEW.streak_id = current_streak_id;
    NEW.streak_reset_from_days = COALESCE(current_days_val, 0);
  END IF;

  -- nouveau streak automatique démarre à j0 tout de suite après rechute
  INSERT INTO mukti.streaks (addiction_id, user_id, started_at, current_days, is_active)
    VALUES (NEW.addiction_id, NEW.user_id, NEW.relapsed_at, 0, true);

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'relapses_handle_relapse') THEN
    CREATE TRIGGER relapses_handle_relapse
      BEFORE INSERT ON mukti.relapses
      FOR EACH ROW EXECUTE FUNCTION mukti.handle_relapse();
  END IF;
END $$;

-- ============================================================
-- auto-create streak on addiction insert (status active)
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.handle_new_addiction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    INSERT INTO mukti.streaks (addiction_id, user_id, started_at, current_days, is_active)
      VALUES (NEW.id, NEW.user_id, NEW.declared_at, 0, true)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'addictions_create_streak') THEN
    CREATE TRIGGER addictions_create_streak
      AFTER INSERT ON mukti.addictions
      FOR EACH ROW EXECUTE FUNCTION mukti.handle_new_addiction();
  END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE mukti.addictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.relapses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.mode_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.trust_fingerprints ENABLE ROW LEVEL SECURITY;

-- addictions: owner rw
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='addictions' AND policyname='addictions_rw_own') THEN
    CREATE POLICY addictions_rw_own ON mukti.addictions
      FOR ALL USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- programs: owner read (write service_role only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='programs' AND policyname='programs_read_own') THEN
    CREATE POLICY programs_read_own ON mukti.programs
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- streaks: owner read (writes via API service_role + triggers)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='streaks' AND policyname='streaks_read_own') THEN
    CREATE POLICY streaks_read_own ON mukti.streaks
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- relapses: owner read+insert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='relapses' AND policyname='relapses_read_own') THEN
    CREATE POLICY relapses_read_own ON mukti.relapses
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='relapses' AND policyname='relapses_insert_own') THEN
    CREATE POLICY relapses_insert_own ON mukti.relapses
      FOR INSERT WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- mode_sessions: owner read+insert+update own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='mode_sessions' AND policyname='mode_sessions_rw_own') THEN
    CREATE POLICY mode_sessions_rw_own ON mukti.mode_sessions
      FOR ALL USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- payment_milestones: owner read only (credit via service_role)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='payment_milestones' AND policyname='payment_milestones_read_own') THEN
    CREATE POLICY payment_milestones_read_own ON mukti.payment_milestones
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- trust_scores: owner read only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='trust_scores' AND policyname='trust_scores_read_own') THEN
    CREATE POLICY trust_scores_read_own ON mukti.trust_scores
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- trust_fingerprints: owner read only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='trust_fingerprints' AND policyname='trust_fingerprints_read_own') THEN
    CREATE POLICY trust_fingerprints_read_own ON mukti.trust_fingerprints
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- ============================================================
-- GRANT usage (PostgREST expose mukti schema pour app layer)
-- ============================================================
GRANT USAGE ON SCHEMA mukti TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA mukti TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mukti TO service_role;
GRANT SELECT, INSERT, UPDATE ON mukti.addictions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON mukti.mode_sessions TO authenticated;
GRANT SELECT, INSERT ON mukti.relapses TO authenticated;

-- ============================================================
-- FIN 0004_g2_liberation_addictions.sql
-- ============================================================

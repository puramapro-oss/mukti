-- ============================================================
-- MUKTI — G6 C.O.R.E. Events + Modes 16-20
-- Migration 0008 : tables C.O.R.E. (5) + tables modes 16-20 (5) + 10 protocoles seeds
--   + extension mode_sessions.mode CHECK (+5 modes : 16-20)
-- Patterns G1-G5 : schema mukti, user_id → mukti.profiles(id),
-- idempotent IF NOT EXISTS, RLS via mukti.current_profile_id().
-- ============================================================

SET search_path = mukti, public;

-- ============================================================
-- 1. core_protocols — 10 protocoles crisis-safe + variantes
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.core_protocols (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  duration_sec INTEGER NOT NULL CHECK (duration_sec BETWEEN 60 AND 1800),
  variant TEXT NOT NULL CHECK (variant IN ('human','animal','wildlife','refuge','universal')),
  description_fr TEXT NOT NULL,
  description_en TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_protocols_variant ON mukti.core_protocols(variant) WHERE active = true;

-- ============================================================
-- 2. core_events — Event Packs (community ou world_radar)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.core_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL CHECK (format IN ('human','animal','one_planet')),
  category TEXT NOT NULL CHECK (category IN (
    'crisis_humanitarian','crisis_natural','crisis_conflict',
    'animal_refuge','animal_wildlife','animal_rescue',
    'collective_healing','planetary_sync'
  )),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  intention_fr TEXT NOT NULL,
  intention_en TEXT NOT NULL,
  region TEXT,
  moment_z_at TIMESTAMPTZ NOT NULL,
  ar_protocol_id TEXT REFERENCES mukti.core_protocols(id),
  source TEXT NOT NULL CHECK (source IN ('community','world_radar','super_admin')),
  confidence NUMERIC(3,2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','live','finished','rejected')),
  created_by UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  ai_pack JSONB,
  auto_published BOOLEAN NOT NULL DEFAULT false,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  participants_count INTEGER NOT NULL DEFAULT 0 CHECK (participants_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_core_events_status_time ON mukti.core_events(status, moment_z_at);
CREATE INDEX IF NOT EXISTS idx_core_events_format ON mukti.core_events(format);
CREATE INDEX IF NOT EXISTS idx_core_events_scheduled ON mukti.core_events(moment_z_at) WHERE status IN ('scheduled','live');

-- ============================================================
-- 3. core_event_sessions — Trilogie Now/24h/7j + phases Moment Z
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.core_event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES mukti.core_events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('now','h24','d7')),
  current_phase TEXT NOT NULL DEFAULT 'pre' CHECK (current_phase IN ('pre','brief','silence','pulse','integration','room','finished')),
  phase_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  protocol_id TEXT REFERENCES mukti.core_protocols(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_core_sessions_event ON mukti.core_event_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_core_sessions_phase ON mukti.core_event_sessions(current_phase, scheduled_at);

-- ============================================================
-- 4. core_event_participants — qui rejoint quel event + livekit token
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.core_event_participants (
  event_id UUID NOT NULL REFERENCES mukti.core_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  ar_synced BOOLEAN NOT NULL DEFAULT false,
  pulse_count INTEGER NOT NULL DEFAULT 0 CHECK (pulse_count >= 0),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_core_parts_user ON mukti.core_event_participants(user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_core_parts_live ON mukti.core_event_participants(event_id) WHERE left_at IS NULL;

-- ============================================================
-- 5. core_world_radar_logs — audit trail Tavily scans
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.core_world_radar_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_queries TEXT[] NOT NULL DEFAULT '{}',
  n_events_found INTEGER NOT NULL DEFAULT 0 CHECK (n_events_found >= 0),
  events_created INTEGER NOT NULL DEFAULT 0 CHECK (events_created >= 0),
  events_moderated INTEGER NOT NULL DEFAULT 0 CHECK (events_moderated >= 0),
  errors TEXT[]
);
CREATE INDEX IF NOT EXISTS idx_radar_logs_time ON mukti.core_world_radar_logs(ran_at DESC);

-- ============================================================
-- 6. energy_replacement_sessions — Mode 16
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.energy_replacement_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('motivation','calme','confiance','energie','concentration')),
  duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 1800),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  urge_before INTEGER CHECK (urge_before IS NULL OR urge_before BETWEEN 1 AND 10),
  urge_after INTEGER CHECK (urge_after IS NULL OR urge_after BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_energy_user_time ON mukti.energy_replacement_sessions(user_id, started_at DESC);

-- ============================================================
-- 7. alt_reality_sessions — Mode 17
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.alt_reality_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  projection_horizon_days INTEGER NOT NULL DEFAULT 30 CHECK (projection_horizon_days IN (7,30,90,365)),
  addiction_id UUID REFERENCES mukti.addictions(id) ON DELETE SET NULL,
  projection_url TEXT,
  projection_prompt TEXT,
  mood_before INTEGER CHECK (mood_before IS NULL OR mood_before BETWEEN 1 AND 10),
  mood_after INTEGER CHECK (mood_after IS NULL OR mood_after BETWEEN 1 AND 10),
  duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 1800),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alt_reality_user_time ON mukti.alt_reality_sessions(user_id, created_at DESC);

-- ============================================================
-- 8. mystery_rewards — Mode 18 (1 claim par user+date)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.mystery_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  tier TEXT NOT NULL CHECK (tier IN ('common','rare','legendary','jackpot')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('points','coupon','booster','coin','xp','nothing')),
  reward_amount INTEGER NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  reward_meta JSONB,
  streak_day INTEGER NOT NULL DEFAULT 1 CHECK (streak_day >= 1),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, claim_date)
);
CREATE INDEX IF NOT EXISTS idx_mystery_user_date ON mukti.mystery_rewards(user_id, claim_date DESC);

-- ============================================================
-- 9. minimal_ritual_ticks — Mode 19 (1 tick par user+habit+date)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.minimal_ritual_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  habit_slug TEXT NOT NULL CHECK (habit_slug IN (
    'respiration_consciente','merci_corps','posture_verticale','geste_nourrissant',
    'pause_ecran','eau_lente','gratitude_micro','contact_nature'
  )),
  tick_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  tick_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, habit_slug, tick_date)
);
CREATE INDEX IF NOT EXISTS idx_minimal_user_date ON mukti.minimal_ritual_ticks(user_id, tick_date DESC);

-- ============================================================
-- 10. mental_journal_entries — Mode 20 (Whisper + Claude analyse)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.mental_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  audio_duration_sec INTEGER CHECK (audio_duration_sec IS NULL OR audio_duration_sec BETWEEN 0 AND 300),
  transcript TEXT,
  transcript_lang TEXT,
  mood_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  mood_score INTEGER CHECK (mood_score IS NULL OR mood_score BETWEEN 1 AND 10),
  energy_score INTEGER CHECK (energy_score IS NULL OR energy_score BETWEEN 1 AND 10),
  anxiety_score INTEGER CHECK (anxiety_score IS NULL OR anxiety_score BETWEEN 1 AND 10),
  relapse_risk NUMERIC(3,2) CHECK (relapse_risk IS NULL OR (relapse_risk >= 0 AND relapse_risk <= 1)),
  insights_fr TEXT[],
  insights_en TEXT[],
  claude_model TEXT,
  flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_user_time ON mukti.mental_journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_high_risk ON mukti.mental_journal_entries(user_id, created_at DESC) WHERE relapse_risk > 0.75 AND alerted_at IS NULL;

-- ============================================================
-- Extension mode_sessions.mode CHECK — 5 nouveaux modes G6
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
      'boucle_urgence','exorcisme','boite_noire','rituel_7s',
      'energie_remplacement','realite_alternative','recompenses_mystere',
      'rituel_minimaliste','journal_mental'
    ));
END $$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE mukti.core_protocols                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.core_events                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.core_event_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.core_event_participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.core_world_radar_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.energy_replacement_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.alt_reality_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.mystery_rewards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.minimal_ritual_ticks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.mental_journal_entries         ENABLE ROW LEVEL SECURITY;

-- core_protocols : public read (active only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_protocols' AND policyname='protocols_read_public') THEN
    CREATE POLICY protocols_read_public ON mukti.core_protocols FOR SELECT
      USING (active = true);
  END IF;
END $$;

-- core_events : public read (scheduled/live/finished)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_events' AND policyname='events_read_published') THEN
    CREATE POLICY events_read_published ON mukti.core_events FOR SELECT
      USING (status IN ('scheduled','live','finished'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_events' AND policyname='events_read_own_drafts') THEN
    CREATE POLICY events_read_own_drafts ON mukti.core_events FOR SELECT
      USING (created_by = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_events' AND policyname='events_insert_own') THEN
    CREATE POLICY events_insert_own ON mukti.core_events FOR INSERT
      WITH CHECK (created_by = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_events' AND policyname='events_update_own_or_admin') THEN
    CREATE POLICY events_update_own_or_admin ON mukti.core_events FOR UPDATE
      USING (created_by = mukti.current_profile_id() OR EXISTS (
        SELECT 1 FROM mukti.profiles WHERE id = mukti.current_profile_id() AND role = 'super_admin'
      ));
  END IF;
END $$;

-- core_event_sessions : public read (liée event public)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_event_sessions' AND policyname='sessions_read_public') THEN
    CREATE POLICY sessions_read_public ON mukti.core_event_sessions FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM mukti.core_events e
        WHERE e.id = core_event_sessions.event_id
          AND e.status IN ('scheduled','live','finished')
      ));
  END IF;
END $$;

-- core_event_participants : user CRUD own + read all pour count
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_event_participants' AND policyname='parts_read_all') THEN
    CREATE POLICY parts_read_all ON mukti.core_event_participants FOR SELECT
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_event_participants' AND policyname='parts_insert_own') THEN
    CREATE POLICY parts_insert_own ON mukti.core_event_participants FOR INSERT
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_event_participants' AND policyname='parts_update_own') THEN
    CREATE POLICY parts_update_own ON mukti.core_event_participants FOR UPDATE
      USING (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_event_participants' AND policyname='parts_delete_own') THEN
    CREATE POLICY parts_delete_own ON mukti.core_event_participants FOR DELETE
      USING (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- core_world_radar_logs : read super_admin only, insert service_role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='core_world_radar_logs' AND policyname='radar_read_admin') THEN
    CREATE POLICY radar_read_admin ON mukti.core_world_radar_logs FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM mukti.profiles WHERE id = mukti.current_profile_id() AND role = 'super_admin'
      ));
  END IF;
END $$;

-- Modes 16-20 : user CRUD own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='energy_replacement_sessions' AND policyname='energy_rw_own') THEN
    CREATE POLICY energy_rw_own ON mukti.energy_replacement_sessions FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='alt_reality_sessions' AND policyname='alt_reality_rw_own') THEN
    CREATE POLICY alt_reality_rw_own ON mukti.alt_reality_sessions FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='mystery_rewards' AND policyname='mystery_rw_own') THEN
    CREATE POLICY mystery_rw_own ON mukti.mystery_rewards FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='minimal_ritual_ticks' AND policyname='minimal_rw_own') THEN
    CREATE POLICY minimal_rw_own ON mukti.minimal_ritual_ticks FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='mental_journal_entries' AND policyname='journal_rw_own') THEN
    CREATE POLICY journal_rw_own ON mukti.mental_journal_entries FOR ALL
      USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- ============================================================
-- Triggers updated_at
-- ============================================================
DROP TRIGGER IF EXISTS core_events_set_updated_at ON mukti.core_events;
CREATE TRIGGER core_events_set_updated_at
  BEFORE UPDATE ON mukti.core_events
  FOR EACH ROW
  EXECUTE FUNCTION mukti.set_updated_at();

DROP TRIGGER IF EXISTS core_sessions_set_updated_at ON mukti.core_event_sessions;
CREATE TRIGGER core_sessions_set_updated_at
  BEFORE UPDATE ON mukti.core_event_sessions
  FOR EACH ROW
  EXECUTE FUNCTION mukti.set_updated_at();

-- ============================================================
-- Triggers : maintien participants_count
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.core_parts_bump_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE mukti.core_events SET participants_count = participants_count + 1
      WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE mukti.core_events SET participants_count = GREATEST(0, participants_count - 1)
      WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS core_parts_count_trigger ON mukti.core_event_participants;
CREATE TRIGGER core_parts_count_trigger
  AFTER INSERT OR DELETE ON mukti.core_event_participants
  FOR EACH ROW
  EXECUTE FUNCTION mukti.core_parts_bump_count();

-- ============================================================
-- PostgREST exposition
-- ============================================================
GRANT SELECT ON mukti.core_protocols TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.core_events                    TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.core_event_sessions            TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.core_event_participants        TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.core_world_radar_logs          TO service_role;
GRANT SELECT ON mukti.core_world_radar_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.energy_replacement_sessions    TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.alt_reality_sessions           TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.mystery_rewards                TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.minimal_ritual_ticks           TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.mental_journal_entries         TO anon, authenticated, service_role;

-- ============================================================
-- Seeds : 10 protocoles crisis-safe
-- ============================================================
INSERT INTO mukti.core_protocols (id, name_fr, name_en, duration_sec, variant, description_fr, description_en, steps) VALUES
  ('panic_off_2min', 'Panic Off', 'Panic Off', 120, 'universal',
    'Coupe le choc. 4 cycles de respiration longue expiration + ancrage pieds.',
    'Cut the shock. 4 cycles of long-exhale breath + foot grounding.',
    '[{"t":0,"label":"Respiration 4-8","sec":80},{"t":80,"label":"Ancrage pieds","sec":40}]'::jsonb),
  ('ancrage_5min', 'Ancrage', 'Grounding', 300, 'universal',
    'Reviens au présent. 5 sens × 1 minute, puis phrase d''ancrage.',
    'Return to the present. 5 senses × 1 minute, then grounding phrase.',
    '[{"t":0,"label":"Vue","sec":60},{"t":60,"label":"Ouïe","sec":60},{"t":120,"label":"Toucher","sec":60},{"t":180,"label":"Odeur","sec":60},{"t":240,"label":"Phrase","sec":60}]'::jsonb),
  ('recuperation_12min', 'Récupération', 'Recovery', 720, 'human',
    'Régulation système nerveux. Double sigh + résonance cardiaque 5.5 respirations/min.',
    'Nervous system regulation. Double sigh + heart coherence 5.5 bpm breathing.',
    '[{"t":0,"label":"Double sigh","sec":120},{"t":120,"label":"Cohérence 5.5","sec":480},{"t":600,"label":"Intégration","sec":120}]'::jsonb),
  ('sommeil_7min', 'Sommeil', 'Sleep', 420, 'human',
    'Glissement vers le sommeil. Respiration 4-7-8 + body scan descendant.',
    'Slide into sleep. 4-7-8 breath + descending body scan.',
    '[{"t":0,"label":"Respiration 4-7-8","sec":180},{"t":180,"label":"Body scan","sec":240}]'::jsonb),
  ('coherence_10min', 'Cohérence', 'Coherence', 600, 'universal',
    'Cohérence cardiaque 5-5 + intention collective synchronisée.',
    'Heart coherence 5-5 + synchronized collective intention.',
    '[{"t":0,"label":"Installation","sec":60},{"t":60,"label":"5-5 cohérence","sec":480},{"t":540,"label":"Sceau","sec":60}]'::jsonb),
  ('soutien_aidants_12min', 'Soutien aidants', 'Caregivers Support', 720, 'human',
    'Pour celles et ceux qui accompagnent. Ressourcement + déliance énergétique.',
    'For those who accompany. Resourcing + energy release.',
    '[{"t":0,"label":"Dépôt","sec":180},{"t":180,"label":"Ressource","sec":360},{"t":540,"label":"Bouclier","sec":180}]'::jsonb),
  ('animal_calm_5min', 'Calme Animal', 'Animal Calm', 300, 'animal',
    'Résonance calme pour animaux en détresse. Fréquences basses + intention protection.',
    'Calm resonance for animals in distress. Low frequencies + protection intention.',
    '[{"t":0,"label":"Son grave","sec":120},{"t":120,"label":"Protection","sec":180}]'::jsonb),
  ('wildlife_urgence_7min', 'Urgence Faune', 'Wildlife Emergency', 420, 'wildlife',
    'Faune sauvage en détresse collective. Canaux ouverts + intention planétaire.',
    'Wildlife in collective distress. Open channels + planetary intention.',
    '[{"t":0,"label":"Ouverture","sec":120},{"t":120,"label":"Canalisation","sec":240},{"t":360,"label":"Clôture","sec":60}]'::jsonb),
  ('refuge_sature_10min', 'Refuge Saturé', 'Saturated Refuge', 600, 'refuge',
    'Refuge animalier en surcharge. Apaisement groupe + soutien bénévoles.',
    'Animal refuge overload. Group soothing + volunteer support.',
    '[{"t":0,"label":"Ancrage refuge","sec":180},{"t":180,"label":"Apaisement","sec":300},{"t":480,"label":"Énergie bénévoles","sec":120}]'::jsonb),
  ('one_planet_sync_12min', 'One Planet Sync', 'One Planet Sync', 720, 'universal',
    'Humains + animaux + nature au même Moment Z. Intention planétaire unique.',
    'Humans + animals + nature at the same Moment Z. Single planetary intention.',
    '[{"t":0,"label":"Pré-brief","sec":120},{"t":120,"label":"Silence mondial","sec":120},{"t":240,"label":"Pulse planétaire","sec":300},{"t":540,"label":"Intégration","sec":180}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

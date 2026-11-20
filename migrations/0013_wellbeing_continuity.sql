-- Optional user declarations. No diagnosis, inferred health score or reward eligibility.
BEGIN;
CREATE TABLE IF NOT EXISTS mukti.wellbeing_checkins (
  user_id uuid NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  time_zone text NOT NULL DEFAULT 'Europe/Paris',
  physical text NOT NULL CHECK (physical IN ('available','limited','rest')),
  cognitive text NOT NULL CHECK (cognitive IN ('available','limited','rest')),
  sensory text NOT NULL CHECK (sensory IN ('available','limited','rest')),
  social text NOT NULL CHECK (social IN ('available','limited','rest')),
  minutes integer NOT NULL CHECK (minutes BETWEEN 0 AND 120),
  consent_version text NOT NULL CHECK (consent_version = 'wellbeing-v1'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS mukti.aurora_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES mukti.aurora_sessions(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('immediate','later')),
  feeling text NOT NULL CHECK (feeling IN ('better','same','worse','unsure')),
  discomfort boolean NOT NULL,
  consent_version text NOT NULL DEFAULT 'wellbeing-v1' CHECK (consent_version = 'wellbeing-v1'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, stage)
);
CREATE INDEX IF NOT EXISTS aurora_feedback_owner ON mukti.aurora_feedback(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS mukti.wellbeing_suggestion_pauses (
  user_id uuid NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  variant text NOT NULL CHECK (variant IN ('calm','focus','sleep','ignite')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, variant)
);
ALTER TABLE mukti.wellbeing_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.aurora_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.wellbeing_suggestion_pauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wellbeing_checkins_read_own ON mukti.wellbeing_checkins;
CREATE POLICY wellbeing_checkins_read_own ON mukti.wellbeing_checkins FOR SELECT TO authenticated
  USING (user_id = mukti.current_profile_id());
DROP POLICY IF EXISTS aurora_feedback_read_own ON mukti.aurora_feedback;
CREATE POLICY aurora_feedback_read_own ON mukti.aurora_feedback FOR SELECT TO authenticated
  USING (user_id = mukti.current_profile_id());
DROP POLICY IF EXISTS wellbeing_pauses_read_own ON mukti.wellbeing_suggestion_pauses;
CREATE POLICY wellbeing_pauses_read_own ON mukti.wellbeing_suggestion_pauses FOR SELECT TO authenticated
  USING (user_id = mukti.current_profile_id());
REVOKE ALL ON mukti.wellbeing_checkins, mukti.aurora_feedback, mukti.wellbeing_suggestion_pauses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON mukti.wellbeing_checkins, mukti.aurora_feedback, mukti.wellbeing_suggestion_pauses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.wellbeing_checkins, mukti.aurora_feedback, mukti.wellbeing_suggestion_pauses TO service_role;

CREATE OR REPLACE FUNCTION mukti.record_aurora_feedback(
  p_user_id uuid, p_session_id uuid, p_stage text, p_feeling text, p_discomfort boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = mukti, pg_temp AS $$
DECLARE s mukti.aurora_sessions%ROWTYPE; f mukti.aurora_feedback%ROWTYPE; inserted_id uuid;
BEGIN
  IF p_stage NOT IN ('immediate','later') OR p_feeling NOT IN ('better','same','worse','unsure')
     OR p_stage IS NULL OR p_feeling IS NULL OR p_discomfort IS NULL THEN
    RAISE EXCEPTION 'Invalid feedback' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO s FROM mukti.aurora_sessions WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR s.completed_at IS NULL THEN
    RAISE EXCEPTION 'Session unavailable' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO f FROM mukti.aurora_feedback WHERE session_id = p_session_id AND stage = p_stage;
  IF FOUND THEN
    RETURN jsonb_build_object('already', true, 'feeling', f.feeling, 'discomfort', f.discomfort);
  END IF;
  -- Four hours is a product distinction between capture windows, not a clinical threshold.
  IF (p_stage = 'later' AND now() < s.completed_at + interval '4 hours')
     OR (p_stage = 'immediate' AND now() >= s.completed_at + interval '4 hours') THEN
    RAISE EXCEPTION 'Feedback window unavailable' USING ERRCODE = '22023';
  END IF;
  INSERT INTO mukti.aurora_feedback(user_id, session_id, stage, feeling, discomfort)
    VALUES (p_user_id, p_session_id, p_stage, p_feeling, p_discomfort) RETURNING id INTO inserted_id;
  IF p_feeling = 'worse' OR p_discomfort THEN
    INSERT INTO mukti.wellbeing_suggestion_pauses(user_id, variant) VALUES(p_user_id, s.variant)
      ON CONFLICT (user_id, variant) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('already', false, 'feeling', p_feeling, 'discomfort', p_discomfort);
END $$;
REVOKE ALL ON FUNCTION mukti.record_aurora_feedback(uuid,uuid,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mukti.record_aurora_feedback(uuid,uuid,text,text,boolean) TO service_role;
COMMIT;

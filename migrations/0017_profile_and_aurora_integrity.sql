-- Server-owned balances, roles and session summaries. Additive, no history deletion.
BEGIN;

-- A table-level REVOKE also removes the corresponding column privileges.
-- Reset client privileges on these server-owned tables, including PUBLIC grants,
-- then restore authenticated reads and the profile settings whitelist below.
-- https://www.postgresql.org/docs/current/sql-revoke.html
DO $$
DECLARE protected_table text; col text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'profiles', 'aurora_sessions', 'aurora_streaks', 'mental_journal_entries',
    'minimal_ritual_ticks', 'mystery_rewards', 'daily_recognitions',
    'wellbeing_checkins', 'aurora_feedback', 'wellbeing_suggestion_pauses'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE mukti.%I FROM PUBLIC, anon, authenticated', protected_table);
    EXECUTE format('GRANT SELECT ON TABLE mukti.%I TO authenticated', protected_table);
  END LOOP;

  -- Existing installations can contain later profile fields. Grant only these user settings.
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'mukti' AND table_name = 'profiles'
      AND column_name IN ('full_name','avatar_url','theme','preferred_locale','notifications_enabled',
        'onboarding_completed','onboarded','tutorial_completed','disclaimer_accepted_at')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON mukti.profiles TO authenticated', col);
  END LOOP;
END $$;

DROP POLICY IF EXISTS aurora_sessions_rw_own ON mukti.aurora_sessions;
DROP POLICY IF EXISTS aurora_sessions_read_own ON mukti.aurora_sessions;
CREATE POLICY aurora_sessions_read_own ON mukti.aurora_sessions FOR SELECT TO authenticated
  USING (user_id = mukti.current_profile_id());
DROP POLICY IF EXISTS aurora_streaks_rw_own ON mukti.aurora_streaks;
DROP POLICY IF EXISTS aurora_streaks_read_own ON mukti.aurora_streaks;
CREATE POLICY aurora_streaks_read_own ON mukti.aurora_streaks FOR SELECT TO authenticated
  USING (user_id = mukti.current_profile_id());
REVOKE ALL ON mukti.aurora_sessions, mukti.aurora_streaks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON mukti.aurora_sessions, mukti.aurora_streaks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.aurora_sessions, mukti.aurora_streaks TO service_role;

CREATE OR REPLACE FUNCTION mukti.complete_aurora_session(
  p_user_id uuid, p_session_id uuid, p_phases jsonb, p_duration numeric, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = mukti, pg_temp AS $$
DECLARE
  s mukti.aurora_sessions%ROWTYPE;
  st mukti.aurora_streaks%ROWTYPE;
  item record; plan integer[]; names text[] := ARRAY['armement','double_sigh','resonance_core','omega_lock','glide_out'];
  phase_sum numeric := 0; clean_phases jsonb := '[]'::jsonb;
  today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  sessions integer; minutes integer; level_name text;
BEGIN
  -- A profile lock serializes distinct simultaneous completions for this user.
  PERFORM 1 FROM mukti.profiles WHERE id = p_user_id FOR UPDATE;
  SELECT * INTO s FROM mukti.aurora_sessions WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE = 'P0002'; END IF;
  IF s.completed_at IS NOT NULL THEN
    SELECT * INTO st FROM mukti.aurora_streaks WHERE user_id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'already', true, 'level_reached', s.level_reached,
      'streak_days', COALESCE(st.current_days, 0));
  END IF;
  IF p_duration IS NULL OR p_duration < 0 OR p_duration > 1800 OR p_duration = 'NaN'::numeric
     OR p_reason IS NULL OR p_reason NOT IN ('user_stop','dizzy','glide_out_complete','timeout','error') THEN
    RAISE EXCEPTION 'Invalid completion' USING ERRCODE = '22023';
  END IF;
  IF p_phases IS NULL OR jsonb_typeof(p_phases) <> 'array' THEN
    RAISE EXCEPTION 'Invalid phases' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_phases) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Invalid phase count' USING ERRCODE = '22023';
  END IF;
  plan := CASE s.variant WHEN 'calm' THEN ARRAY[8,40,240,120,60]
    WHEN 'focus' THEN ARRAY[8,30,120,60,30] WHEN 'sleep' THEN ARRAY[8,60,360,120,60]
    ELSE ARRAY[8,20,60,20,20] END;
  FOR item IN SELECT value, ordinality::integer AS n FROM jsonb_array_elements(p_phases) WITH ORDINALITY LOOP
    IF (item.value->>'phase') IS DISTINCT FROM names[item.n]
      OR jsonb_typeof(item.value->'duration_sec') IS DISTINCT FROM 'number'
      OR jsonb_typeof(item.value->'breaths_counted') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Invalid phase' USING ERRCODE = '22023';
    END IF;
    IF (item.value->>'duration_sec')::numeric NOT BETWEEN 0 AND plan[item.n]
      OR (item.value->>'breaths_counted')::numeric NOT BETWEEN 0 AND 500
      OR (item.value->>'breaths_counted')::numeric <> trunc((item.value->>'breaths_counted')::numeric)
      OR (item.n < jsonb_array_length(p_phases) AND (item.value->>'duration_sec')::numeric <> plan[item.n]) THEN
      RAISE EXCEPTION 'Invalid phase duration' USING ERRCODE = '22023';
    END IF;
    phase_sum := phase_sum + (item.value->>'duration_sec')::numeric;
    clean_phases := clean_phases || jsonb_build_array(jsonb_build_object(
      'phase', names[item.n], 'duration_sec', (item.value->>'duration_sec')::numeric,
      'breaths_counted', (item.value->>'breaths_counted')::integer, 'coherence', NULL));
  END LOOP;
  IF abs(phase_sum - p_duration) > 1 OR p_duration > extract(epoch FROM now() - s.started_at) + 3
    OR (p_reason = 'glide_out_complete' AND (jsonb_array_length(p_phases) <> 5 OR phase_sum <> (SELECT sum(n) FROM unnest(plan) n))) THEN
    RAISE EXCEPTION 'Inconsistent duration' USING ERRCODE = '22023';
  END IF;
  UPDATE mukti.aurora_sessions SET completed_at = now(), duration_sec = round(p_duration),
    phases_completed = clean_phases, coherence_score = NULL, stopped_reason = p_reason
    WHERE id = p_session_id;

  -- This is an explicit stop-button declaration, not an inferred diagnosis or cause.
  -- Keep it in the completion transaction. The early idempotent return above also
  -- preserves a later voluntary resumption when an old completion is replayed.
  IF p_reason = 'dizzy' THEN
    INSERT INTO mukti.wellbeing_suggestion_pauses(user_id, variant)
      VALUES (p_user_id, s.variant) ON CONFLICT (user_id, variant) DO NOTHING;
  END IF;

  INSERT INTO mukti.aurora_streaks(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO st FROM mukti.aurora_streaks WHERE user_id = p_user_id FOR UPDATE;
  SELECT count(*)::integer, floor(COALESCE(sum(duration_sec),0)/60.0)::integer INTO sessions, minutes
    FROM mukti.aurora_sessions WHERE user_id = p_user_id AND completed_at IS NOT NULL AND duration_sec > 0;
  -- Existing milestones stay acquired. No consecutive-day requirement and no intensity change.
  level_name := CASE WHEN sessions >= 40 OR st.current_level = 'polaris' THEN 'polaris'
    WHEN sessions >= 15 OR st.current_level = 'aura' THEN 'aura'
    WHEN sessions >= 5 OR st.current_level = 'onde' THEN 'onde' ELSE 'brume' END;
  UPDATE mukti.aurora_sessions SET level_reached = level_name WHERE id = p_session_id;
  UPDATE mukti.aurora_streaks SET total_sessions = sessions, total_minutes = minutes,
    current_level = level_name,
    current_days = CASE WHEN p_duration < 1 THEN current_days WHEN last_session_date = today THEN current_days
      WHEN last_session_date = today - 1 THEN current_days + 1 ELSE 1 END,
    best_days = greatest(best_days, CASE WHEN p_duration < 1 THEN current_days WHEN last_session_date = today THEN current_days
      WHEN last_session_date = today - 1 THEN current_days + 1 ELSE 1 END),
    last_session_date = CASE WHEN p_duration >= 1 THEN today ELSE last_session_date END, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO st;
  RETURN jsonb_build_object('ok', true, 'already', false, 'level_reached', level_name, 'streak_days', st.current_days);
END $$;
REVOKE ALL ON FUNCTION mukti.complete_aurora_session(uuid,uuid,jsonb,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mukti.complete_aurora_session(uuid,uuid,jsonb,numeric,text) TO service_role;
COMMIT;

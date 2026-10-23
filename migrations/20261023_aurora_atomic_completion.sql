-- AURORA completion: one transaction for the session and its progression.
-- Apply through the normal reviewed migration process BEFORE the matching server code.
-- This file is not executed against production by the regression workflow.
BEGIN;

CREATE OR REPLACE FUNCTION mukti.aurora_complete_session_atomic_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_phases_completed jsonb,
  p_coherence_score double precision,
  p_stopped_reason text,
  p_total_duration_sec double precision
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_session mukti.aurora_sessions%ROWTYPE;
  v_streak mukti.aurora_streaks%ROWTYPE;
  v_phase jsonb;
  v_names text[] := ARRAY['armement','double_sigh','resonance_core','omega_lock','glide_out'];
  v_index integer := 0;
  v_sum double precision := 0;
  v_today date := (pg_catalog.now() AT TIME ZONE 'UTC')::date;
  v_current integer;
  v_best integer;
  v_minutes integer;
  v_sessions integer;
  v_level text;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL
     OR p_total_duration_sec IS NULL OR NOT (p_total_duration_sec >= 0 AND p_total_duration_sec <= 1800)
     OR p_coherence_score IS NULL OR NOT (p_coherence_score >= 0 AND p_coherence_score <= 1)
     OR p_stopped_reason IS NULL OR p_stopped_reason NOT IN ('user_stop','dizzy','glide_out_complete','timeout','error')
     OR pg_catalog.jsonb_typeof(p_phases_completed) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid AURORA completion input' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_array_length(p_phases_completed) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Invalid AURORA phase count' USING ERRCODE = '22023';
  END IF;

  FOR v_phase IN SELECT value FROM pg_catalog.jsonb_array_elements(p_phases_completed) LOOP
    v_index := v_index + 1;
    IF pg_catalog.jsonb_typeof(v_phase) IS DISTINCT FROM 'object'
       OR (v_phase ->> 'phase') IS DISTINCT FROM v_names[v_index]
       OR pg_catalog.jsonb_typeof(v_phase -> 'duration_sec') IS DISTINCT FROM 'number'
       OR pg_catalog.jsonb_typeof(v_phase -> 'breaths_counted') IS DISTINCT FROM 'number'
       OR NOT (v_phase ? 'coherence') THEN
      RAISE EXCEPTION 'Invalid AURORA phase structure' USING ERRCODE = '22023';
    END IF;
    IF NOT ((v_phase ->> 'duration_sec')::double precision >= 0
            AND (v_phase ->> 'duration_sec')::double precision <= 1800)
       OR NOT ((v_phase ->> 'breaths_counted')::numeric >= 0
               AND (v_phase ->> 'breaths_counted')::numeric <= 500)
       OR (v_phase ->> 'breaths_counted')::numeric <> pg_catalog.trunc((v_phase ->> 'breaths_counted')::numeric) THEN
      RAISE EXCEPTION 'Invalid AURORA phase values' USING ERRCODE = '22023';
    END IF;
    IF v_phase -> 'coherence' <> 'null'::jsonb THEN
      IF pg_catalog.jsonb_typeof(v_phase -> 'coherence') IS DISTINCT FROM 'number'
         OR NOT ((v_phase ->> 'coherence')::double precision >= 0
                 AND (v_phase ->> 'coherence')::double precision <= 1) THEN
        RAISE EXCEPTION 'Invalid AURORA guidance timing value' USING ERRCODE = '22023';
      END IF;
    END IF;
    v_sum := v_sum + (v_phase ->> 'duration_sec')::double precision;
  END LOOP;
  -- The current engine rounds only the final partial phase to 0.1 seconds.
  IF pg_catalog.abs(v_sum - p_total_duration_sec) > 0.11 THEN
    RAISE EXCEPTION 'Inconsistent AURORA duration' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
    FROM mukti.aurora_sessions
    WHERE id = p_session_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Session introuvable.');
  END IF;
  IF v_session.completed_at IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Session déjà complétée.');
  END IF;

  -- No error is interpreted as an empty history. A database failure aborts all writes.
  INSERT INTO mukti.aurora_streaks (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO STRICT v_streak
    FROM mukti.aurora_streaks WHERE user_id = p_user_id FOR UPDATE;

  IF v_streak.last_session_date IS NULL THEN
    v_current := 1;
  ELSIF v_streak.last_session_date = v_today THEN
    v_current := GREATEST(v_streak.current_days, 1);
  ELSIF v_today - v_streak.last_session_date = 1 THEN
    v_current := v_streak.current_days + 1;
  ELSIF v_streak.last_session_date > v_today THEN
    RAISE EXCEPTION 'AURORA progression has a future date' USING ERRCODE = '22023';
  ELSE
    v_current := 1;
  END IF;
  v_best := GREATEST(v_streak.best_days, v_current);
  v_minutes := v_streak.total_minutes + pg_catalog.floor(p_total_duration_sec / 60 + 0.5)::integer;
  v_sessions := v_streak.total_sessions + 1;
  -- Must stay aligned with AURORA_LEVELS; exercised by the database regression suite.
  v_level := CASE
    WHEN v_current >= 60 AND v_sessions >= 40 THEN 'polaris'
    WHEN v_current >= 21 AND v_sessions >= 15 THEN 'aura'
    WHEN v_current >= 7 AND v_sessions >= 5 THEN 'onde'
    ELSE 'brume' END;

  UPDATE mukti.aurora_sessions
    SET completed_at = pg_catalog.now(),
        duration_sec = pg_catalog.floor(p_total_duration_sec + 0.5)::integer,
        phases_completed = p_phases_completed,
        coherence_score = p_coherence_score,
        level_reached = v_level,
        stopped_reason = p_stopped_reason
    WHERE id = p_session_id AND user_id = p_user_id;
  UPDATE mukti.aurora_streaks
    SET current_days = v_current,
        best_days = v_best,
        last_session_date = v_today,
        current_level = v_level,
        total_minutes = v_minutes,
        total_sessions = v_sessions,
        updated_at = pg_catalog.now()
    WHERE user_id = p_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'error', NULL, 'level_reached', v_level, 'streak_days', v_current);
END;
$function$;

-- Only the authenticated server route's service client can invoke this function.
-- SECURITY INVOKER deliberately grants no privileges to an unprivileged caller.
REVOKE ALL ON FUNCTION mukti.aurora_complete_session_atomic_v1(uuid,uuid,jsonb,double precision,text,double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mukti.aurora_complete_session_atomic_v1(uuid,uuid,jsonb,double precision,text,double precision)
  TO service_role;
COMMENT ON FUNCTION mukti.aurora_complete_session_atomic_v1(uuid,uuid,jsonb,double precision,text,double precision)
  IS 'Atomic AURORA session and progression completion; server-only; no automatic mutation retries.';
COMMIT;

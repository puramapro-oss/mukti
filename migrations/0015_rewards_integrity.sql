-- Free daily recognition replaces the issuance of random/streak-based rewards.
-- Legacy receipts and all existing balances are preserved byte-for-byte.
-- Apply before deploying the new recognition endpoint. No financial migration.
BEGIN;

CREATE TABLE IF NOT EXISTS mukti.daily_recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  recognition_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  recognized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_recognitions_user_day_unique UNIQUE (user_id, recognition_date),
  CONSTRAINT daily_recognitions_utc_day_check
    CHECK (recognition_date = (recognized_at AT TIME ZONE 'UTC')::date)
);

COMMENT ON TABLE mukti.daily_recognitions IS
  'Free acknowledgement only, including rest or no activity. No monetary, point, quota or medical value.';

ALTER TABLE mukti.daily_recognitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_recognitions_read_own ON mukti.daily_recognitions;
CREATE POLICY daily_recognitions_read_own ON mukti.daily_recognitions
  FOR SELECT TO authenticated
  USING (user_id = mukti.current_profile_id());

-- Existing schema defaults grant broad DML: revoke explicitly, then grant reads.
REVOKE ALL ON TABLE mukti.daily_recognitions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE mukti.daily_recognitions TO authenticated;
GRANT ALL ON TABLE mukti.daily_recognitions TO service_role;

-- Legacy entries are receipts, never a client-controlled balance or eligibility gate.
DROP POLICY IF EXISTS mystery_rw_own ON mukti.mystery_rewards;
DROP POLICY IF EXISTS mystery_read_own ON mukti.mystery_rewards;
CREATE POLICY mystery_read_own ON mukti.mystery_rewards
  FOR SELECT TO authenticated
  USING (user_id = mukti.current_profile_id());
REVOKE ALL ON TABLE mukti.mystery_rewards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE mukti.mystery_rewards TO authenticated;
GRANT ALL ON TABLE mukti.mystery_rewards TO service_role;

-- Called only by the server after resolving the profile from the authenticated user.
-- SECURITY INVOKER + restricted EXECUTE avoids a public SECURITY DEFINER write path.
CREATE OR REPLACE FUNCTION mukti.record_daily_recognition(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_date DATE := (v_now AT TIME ZONE 'UTC')::date;
  v_row mukti.daily_recognitions%ROWTYPE;
  v_already BOOLEAN := false;
BEGIN
  INSERT INTO mukti.daily_recognitions (user_id, recognition_date, recognized_at)
  VALUES (p_profile_id, v_date, v_now)
  ON CONFLICT (user_id, recognition_date) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    -- A concurrent INSERT waits on the unique key. This subsequent statement sees
    -- the committed row at READ COMMITTED, without changing it or creating benefits.
    SELECT * INTO STRICT v_row
    FROM mukti.daily_recognitions
    WHERE user_id = p_profile_id AND recognition_date = v_date;
    v_already := true;
  END IF;

  RETURN jsonb_build_object(
    'recognition', jsonb_build_object(
      'id', v_row.id,
      'recognition_date', v_row.recognition_date,
      'recognized_at', v_row.recognized_at
    ),
    'already_recorded', v_already
  );
END;
$$;

REVOKE ALL ON FUNCTION mukti.record_daily_recognition(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mukti.record_daily_recognition(UUID) TO service_role;

COMMIT;

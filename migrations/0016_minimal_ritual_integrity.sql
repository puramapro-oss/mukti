-- Minimal ritual: preserve historical UTC dates; new records use the displayed local day.
-- Rest is a declared choice, never proof that an exercise was completed.
BEGIN;

ALTER TABLE mukti.minimal_ritual_ticks
  ADD COLUMN IF NOT EXISTS participation_mode TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE mukti.minimal_ritual_ticks
  ALTER COLUMN time_zone SET DEFAULT 'Europe/Paris',
  ALTER COLUMN tick_date SET DEFAULT (now() AT TIME ZONE 'Europe/Paris')::date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'mukti.minimal_ritual_ticks'::regclass
      AND conname = 'minimal_ritual_participation_mode_check'
  ) THEN
    ALTER TABLE mukti.minimal_ritual_ticks
      ADD CONSTRAINT minimal_ritual_participation_mode_check
      CHECK (participation_mode IN ('standard', 'adapted', 'rest'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'mukti.minimal_ritual_ticks'::regclass
      AND conname = 'minimal_ritual_time_zone_check'
  ) THEN
    ALTER TABLE mukti.minimal_ritual_ticks
      ADD CONSTRAINT minimal_ritual_time_zone_check
      CHECK (length(time_zone) BETWEEN 1 AND 100);
  END IF;
END;
$$;

-- The API derives ownership and date from the authenticated session.
-- Direct clients cannot forge a date, mode or progress through table writes.
REVOKE INSERT, UPDATE, DELETE ON mukti.minimal_ritual_ticks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.minimal_ritual_ticks TO service_role;

-- Aggregate in PostgreSQL rather than silently truncating a user's history at 500 rows.
-- p_user_id is resolved by the server, never accepted from a request body.
CREATE OR REPLACE FUNCTION mukti.minimal_ritual_summary(p_user_id UUID, p_today DATE)
RETURNS TABLE (
  habit_slug TEXT,
  recorded_today BOOLEAN,
  ticked_today BOOLEAN,
  mode_today TEXT,
  progress_days INTEGER,
  practice_days INTEGER,
  rest_days INTEGER,
  streak_days INTEGER
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = mukti, pg_temp
AS $$
  WITH owned AS (
    SELECT t.habit_slug, t.tick_date, t.participation_mode
    FROM mukti.minimal_ritual_ticks t
    WHERE t.user_id = p_user_id AND t.tick_date <= p_today
  ), numbered AS (
    SELECT o.habit_slug, o.tick_date,
      o.tick_date - (row_number() OVER (PARTITION BY o.habit_slug ORDER BY o.tick_date))::INTEGER AS series_key
    FROM owned o
  ), runs AS (
    SELECT n.habit_slug, max(n.tick_date) AS last_day, count(*)::INTEGER AS length
    FROM numbered n GROUP BY n.habit_slug, n.series_key
  ), latest AS (
    SELECT r.habit_slug, max(r.length)::INTEGER AS length
    FROM runs r WHERE r.last_day >= p_today - 1 GROUP BY r.habit_slug
  )
  SELECT o.habit_slug,
    bool_or(o.tick_date = p_today),
    bool_or(o.tick_date = p_today AND o.participation_mode <> 'rest'),
    max(o.participation_mode) FILTER (WHERE o.tick_date = p_today),
    count(*)::INTEGER,
    (count(*) FILTER (WHERE o.participation_mode <> 'rest'))::INTEGER,
    (count(*) FILTER (WHERE o.participation_mode = 'rest'))::INTEGER,
    coalesce(max(l.length), 0)::INTEGER
  FROM owned o
  LEFT JOIN latest l ON l.habit_slug = o.habit_slug
  GROUP BY o.habit_slug;
$$;

REVOKE ALL ON FUNCTION mukti.minimal_ritual_summary(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mukti.minimal_ritual_summary(UUID, DATE) TO service_role;

COMMENT ON FUNCTION mukti.minimal_ritual_summary(UUID, DATE) IS
  'Owner-scoped server summary. Recorded rest is separate from completed practices. No rewards or clinical inference.';

COMMIT;

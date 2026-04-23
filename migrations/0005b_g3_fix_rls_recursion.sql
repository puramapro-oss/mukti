-- ============================================================
-- MUKTI — G3 fix RLS récursion infinie sur circle_participants
-- Patch 0005b : helper SECURITY DEFINER + simplification policy
-- ============================================================

SET search_path = mukti, public;

-- ============================================================
-- Helper SECURITY DEFINER (bypass RLS pour le check d'appartenance)
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.user_in_circle(p_circle_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = mukti, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM mukti.circle_participants
    WHERE circle_id = p_circle_id
      AND user_id = p_user_id
      AND left_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION mukti.user_in_circle(UUID, UUID) TO anon, authenticated, service_role;

-- ============================================================
-- circle_participants : policy SELECT publique (qui est dans un cercle public/live = info lisible)
-- (remplace cp_read_same_circle qui provoquait récursion)
-- ============================================================
DROP POLICY IF EXISTS cp_read_same_circle ON mukti.circle_participants;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_participants' AND policyname='cp_read_public') THEN
    CREATE POLICY cp_read_public ON mukti.circle_participants
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- circle_rotations : réécriture policy via helper (plus de récursion circle_participants)
-- ============================================================
DROP POLICY IF EXISTS cr_read_participant ON mukti.circle_rotations;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_rotations' AND policyname='cr_read') THEN
    CREATE POLICY cr_read ON mukti.circle_rotations
      FOR SELECT USING (
        mukti.user_in_circle(circle_id, mukti.current_profile_id())
        OR focused_user_id = mukti.current_profile_id()
        OR EXISTS (SELECT 1 FROM mukti.circles c WHERE c.id = circle_rotations.circle_id AND c.status IN ('live','finished'))
      );
  END IF;
END $$;

-- ============================================================
-- circle_messages : réécriture via helper
-- ============================================================
DROP POLICY IF EXISTS cm_read ON mukti.circle_messages;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_messages' AND policyname='cm_read_v2') THEN
    CREATE POLICY cm_read_v2 ON mukti.circle_messages
      FOR SELECT USING (
        deleted_at IS NULL
        AND (
          kind = 'forum'
          OR user_id = mukti.current_profile_id()
          OR mukti.user_in_circle(circle_id, mukti.current_profile_id())
        )
      );
  END IF;
END $$;

-- ============================================================
-- circle_replays : réécriture via helper
-- ============================================================
DROP POLICY IF EXISTS replays_read_participant ON mukti.circle_replays;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_replays' AND policyname='replays_read') THEN
    CREATE POLICY replays_read ON mukti.circle_replays
      FOR SELECT USING (
        mukti.user_in_circle(circle_id, mukti.current_profile_id())
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

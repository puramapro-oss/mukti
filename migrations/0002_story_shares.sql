-- ============================================================================
-- STORY SHARES — partages story 1080×1920 sur réseaux sociaux
-- ============================================================================
SET search_path = vida_aide, public;

CREATE TABLE IF NOT EXISTS vida_aide.story_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES vida_aide.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('streak', 'palier', 'mission', 'gains', 'classement', 'achievement', 'scan')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_url TEXT,
  shared_to TEXT,
  points_given INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS story_shares_user_id_idx ON vida_aide.story_shares(user_id);
CREATE INDEX IF NOT EXISTS story_shares_created_at_idx ON vida_aide.story_shares(created_at DESC);
CREATE INDEX IF NOT EXISTS story_shares_user_created_idx ON vida_aide.story_shares(user_id, created_at DESC);

ALTER TABLE vida_aide.story_shares ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='vida_aide' AND tablename='story_shares' AND policyname='story_shares_user_own') THEN
    CREATE POLICY story_shares_user_own ON vida_aide.story_shares FOR ALL
      USING (user_id IN (SELECT id FROM vida_aide.profiles WHERE auth_user_id = auth.uid()))
      WITH CHECK (user_id IN (SELECT id FROM vida_aide.profiles WHERE auth_user_id = auth.uid()));
  END IF;
END $$;

GRANT SELECT, INSERT ON vida_aide.story_shares TO authenticated;
GRANT ALL ON vida_aide.story_shares TO service_role;

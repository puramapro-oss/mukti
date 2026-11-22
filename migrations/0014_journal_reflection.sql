-- Existing writings are retained. Historical inferred columns are not exposed by the app.
BEGIN;

ALTER TABLE mukti.mental_journal_entries
  ADD COLUMN IF NOT EXISTS entry_source TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS reflection JSONB,
  ADD COLUMN IF NOT EXISTS reflection_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS reflection_model TEXT,
  ADD COLUMN IF NOT EXISTS transcription_consent_version TEXT,
  ADD COLUMN IF NOT EXISTS transcription_consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reflection_consent_version TEXT,
  ADD COLUMN IF NOT EXISTS reflection_consented_at TIMESTAMPTZ;

-- The temporary legacy default backfilled old rows only.
ALTER TABLE mukti.mental_journal_entries ALTER COLUMN entry_source SET DEFAULT 'text';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_reflection_contract' AND conrelid = 'mukti.mental_journal_entries'::regclass) THEN
    ALTER TABLE mukti.mental_journal_entries ADD CONSTRAINT journal_reflection_contract CHECK (
      entry_source IN ('legacy', 'text', 'audio')
      AND reflection_status IN ('not_requested', 'available', 'unavailable')
      AND ((reflection_status = 'available' AND reflection IS NOT NULL AND jsonb_typeof(reflection) = 'object')
        OR (reflection_status <> 'available' AND reflection IS NULL))
      AND ((transcription_consent_version IS NULL) = (transcription_consented_at IS NULL))
      AND ((reflection_consent_version IS NULL) = (reflection_consented_at IS NULL))
      AND (entry_source <> 'audio' OR (transcription_consent_version IS NOT NULL AND audio_duration_sec IS NOT NULL AND audio_duration_sec BETWEEN 0 AND 180))
      AND (reflection_status = 'not_requested' OR reflection_consent_version IS NOT NULL)
      AND (entry_source = 'legacy' OR (
        transcript IS NOT NULL AND char_length(btrim(transcript)) BETWEEN 1 AND 8000
        AND mood_score IS NULL AND energy_score IS NULL AND anxiety_score IS NULL
        AND relapse_risk IS NULL AND flagged_for_review = false AND alerted_at IS NULL
        AND mood_analysis = '{}'::jsonb AND insights_fr IS NULL AND insights_en IS NULL AND claude_model IS NULL
      ))
    );
  END IF;
END $$;

DROP INDEX IF EXISTS mukti.idx_journal_high_risk;
-- Authenticated readers retain the existing ownership RLS policy. All mutations
-- go through the authenticated journal API, which verifies current consent.
REVOKE INSERT, UPDATE, DELETE ON mukti.mental_journal_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mukti.mental_journal_entries TO service_role;
COMMENT ON COLUMN mukti.mental_journal_entries.relapse_risk IS 'Legacy only. Never generated, exposed, or used to trigger alerts by the journal application.';
COMMENT ON COLUMN mukti.mental_journal_entries.reflection IS 'Optional verified quotations and fixed reflection questions; not a clinical assessment.';
COMMENT ON COLUMN mukti.mental_journal_entries.entry_source IS 'legacy identifies existing entries; text/audio identify the new consented journal flow.';

COMMIT;

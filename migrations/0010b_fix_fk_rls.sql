-- MUKTI G8 — Migration 0010b — Fix FK + RLS patterns
-- Pattern correct : user_id REFERENCES mukti.profiles(id) + RLS via current_profile_id()

SET search_path TO mukti, public;

-- ============================================================================
-- Drop existing FK constraints (auth.users) + recreate to mukti.profiles
-- ============================================================================

ALTER TABLE mukti.accompagnants_profiles DROP CONSTRAINT IF EXISTS accompagnants_profiles_user_id_fkey;
ALTER TABLE mukti.accompagnants_profiles
  ADD CONSTRAINT accompagnants_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES mukti.profiles(id) ON DELETE CASCADE;

ALTER TABLE mukti.accompagnants_testimonials DROP CONSTRAINT IF EXISTS accompagnants_testimonials_user_id_fkey;
ALTER TABLE mukti.accompagnants_testimonials
  ADD CONSTRAINT accompagnants_testimonials_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES mukti.profiles(id) ON DELETE SET NULL;

ALTER TABLE mukti.life_feed_entries DROP CONSTRAINT IF EXISTS life_feed_entries_user_id_fkey;
ALTER TABLE mukti.life_feed_entries
  ADD CONSTRAINT life_feed_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES mukti.profiles(id) ON DELETE CASCADE;

ALTER TABLE mukti.life_feed_projections DROP CONSTRAINT IF EXISTS life_feed_projections_user_id_fkey;
ALTER TABLE mukti.life_feed_projections
  ADD CONSTRAINT life_feed_projections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES mukti.profiles(id) ON DELETE CASCADE;

ALTER TABLE mukti.rituel_hebdo_participations DROP CONSTRAINT IF EXISTS rituel_hebdo_participations_user_id_fkey;
ALTER TABLE mukti.rituel_hebdo_participations
  ADD CONSTRAINT rituel_hebdo_participations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES mukti.profiles(id) ON DELETE CASCADE;

ALTER TABLE mukti.admin_settings DROP CONSTRAINT IF EXISTS admin_settings_updated_by_fkey;
ALTER TABLE mukti.admin_settings
  ADD CONSTRAINT admin_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES mukti.profiles(id) ON DELETE SET NULL;

ALTER TABLE mukti.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_admin_user_id_fkey;
ALTER TABLE mukti.admin_audit_log
  ADD CONSTRAINT admin_audit_log_admin_user_id_fkey
  FOREIGN KEY (admin_user_id) REFERENCES mukti.profiles(id) ON DELETE SET NULL;

ALTER TABLE mukti.qa_conversations DROP CONSTRAINT IF EXISTS qa_conversations_user_id_fkey;
ALTER TABLE mukti.qa_conversations
  ADD CONSTRAINT qa_conversations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES mukti.profiles(id) ON DELETE CASCADE;

-- ============================================================================
-- Replace RLS policies : use mukti.current_profile_id() instead of auth.uid()
-- ============================================================================

DROP POLICY IF EXISTS "accomp_profiles_self" ON mukti.accompagnants_profiles;
CREATE POLICY "accomp_profiles_self" ON mukti.accompagnants_profiles
  FOR ALL USING (user_id = mukti.current_profile_id())
  WITH CHECK (user_id = mukti.current_profile_id());

DROP POLICY IF EXISTS "accomp_testimonials_insert_self" ON mukti.accompagnants_testimonials;
CREATE POLICY "accomp_testimonials_insert_self" ON mukti.accompagnants_testimonials
  FOR INSERT WITH CHECK (user_id = mukti.current_profile_id());

DROP POLICY IF EXISTS "life_feed_self" ON mukti.life_feed_entries;
CREATE POLICY "life_feed_self" ON mukti.life_feed_entries
  FOR ALL USING (user_id = mukti.current_profile_id())
  WITH CHECK (user_id = mukti.current_profile_id());

DROP POLICY IF EXISTS "life_projections_self" ON mukti.life_feed_projections;
CREATE POLICY "life_projections_self" ON mukti.life_feed_projections
  FOR ALL USING (user_id = mukti.current_profile_id())
  WITH CHECK (user_id = mukti.current_profile_id());

DROP POLICY IF EXISTS "rituel_part_self" ON mukti.rituel_hebdo_participations;
CREATE POLICY "rituel_part_self" ON mukti.rituel_hebdo_participations
  FOR ALL USING (user_id = mukti.current_profile_id())
  WITH CHECK (user_id = mukti.current_profile_id());

DROP POLICY IF EXISTS "admin_settings_super_admin" ON mukti.admin_settings;
CREATE POLICY "admin_settings_super_admin" ON mukti.admin_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mukti.profiles p WHERE p.id = mukti.current_profile_id() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "admin_audit_super_admin" ON mukti.admin_audit_log;
CREATE POLICY "admin_audit_super_admin" ON mukti.admin_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mukti.profiles p WHERE p.id = mukti.current_profile_id() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "qa_conversations_self" ON mukti.qa_conversations;
CREATE POLICY "qa_conversations_self" ON mukti.qa_conversations
  FOR ALL USING (user_id = mukti.current_profile_id())
  WITH CHECK (user_id = mukti.current_profile_id());

NOTIFY pgrst, 'reload schema';

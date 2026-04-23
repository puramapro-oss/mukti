-- ============================================================
-- MUKTI — G3 Cercles d'Intention ∞
-- Migration 0005 : 8 tables + triggers + RLS + indexes + seed 140 phrases
-- Patterns alignés G1+G2 : schema mukti, user_id → mukti.profiles(id),
-- idempotent IF NOT EXISTS, RLS via mukti.current_profile_id(),
-- updated_at via mukti.set_updated_at() (G1).
-- ============================================================

SET search_path = mukti, public;

-- ============================================================
-- 1. circles — cercle d'intention (open/live/finished/cancelled)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'abondance','amour_soi','apaisement','motivation','renouveau',
    'confiance','protection','alignement','paix','ancrage',
    'clarte','gratitude','liberation','manifestation'
  )),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description TEXT CHECK (description IS NULL OR length(description) <= 600),
  max_participants INTEGER NOT NULL CHECK (max_participants BETWEEN 2 AND 5000),
  duration_per_person_sec INTEGER NOT NULL DEFAULT 300 CHECK (duration_per_person_sec BETWEEN 60 AND 900),
  rotation_mode TEXT NOT NULL DEFAULT 'auto' CHECK (rotation_mode IN ('auto','random','fixed')),
  guidance_mode TEXT NOT NULL DEFAULT 'voice' CHECK (guidance_mode IN (
    'voice','breath','visualization','mental','silence','sound','light','pure'
  )),
  audio_mode TEXT NOT NULL DEFAULT 'auto' CHECK (audio_mode IN ('mesh','sfu','auto')),
  selected_phrase_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  livekit_room_name TEXT,
  recording_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_start_when_full BOOLEAN NOT NULL DEFAULT true,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','live','finished','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_circles_category_status ON mukti.circles(category, status);
CREATE INDEX IF NOT EXISTS idx_circles_creator ON mukti.circles(creator_id);
CREATE INDEX IF NOT EXISTS idx_circles_status_scheduled ON mukti.circles(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_circles_open ON mukti.circles(category) WHERE status IN ('open','live');

-- ============================================================
-- 2. circle_participants — participants d'un cercle
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.circle_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES mukti.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('participant','creator','moderator')),
  rotation_position INTEGER NOT NULL DEFAULT 0,
  received_focus BOOLEAN NOT NULL DEFAULT false,
  mic_muted BOOLEAN NOT NULL DEFAULT false,
  cam_enabled BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE (circle_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cp_circle ON mukti.circle_participants(circle_id);
CREATE INDEX IF NOT EXISTS idx_cp_user ON mukti.circle_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_cp_active ON mukti.circle_participants(circle_id) WHERE left_at IS NULL;

-- ============================================================
-- 3. circle_rotations — tour de rôle (1 focused_user_id à la fois)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.circle_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES mukti.circles(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  focused_user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  planned_duration_sec INTEGER NOT NULL CHECK (planned_duration_sec BETWEEN 60 AND 900),
  actual_duration_sec INTEGER,
  UNIQUE (circle_id, round_number)
);
CREATE INDEX IF NOT EXISTS idx_cr_circle_round ON mukti.circle_rotations(circle_id, round_number);
CREATE INDEX IF NOT EXISTS idx_cr_active ON mukti.circle_rotations(circle_id) WHERE ended_at IS NULL;

-- ============================================================
-- 4. circle_messages — ressenti + gratitude post-session + forum
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.circle_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES mukti.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'gratitude' CHECK (kind IN ('feeling','gratitude','kind_message','forum')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  reactions_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cm_circle ON mukti.circle_messages(circle_id);
CREATE INDEX IF NOT EXISTS idx_cm_user ON mukti.circle_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_forum ON mukti.circle_messages(created_at DESC) WHERE kind = 'forum' AND deleted_at IS NULL;

-- ============================================================
-- 5. circle_reports — signalement participant (auto-mute 3+)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.circle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES mukti.circles(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('hate','disruption','medical_claim','spam','harassment','other')),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (circle_id, reporter_id, reported_user_id)
);
CREATE INDEX IF NOT EXISTS idx_cr_reports_target ON mukti.circle_reports(circle_id, reported_user_id);

-- ============================================================
-- 6. intention_phrases — banque phrases conscientes 14 catégories
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.intention_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'abondance','amour_soi','apaisement','motivation','renouveau',
    'confiance','protection','alignement','paix','ancrage',
    'clarte','gratitude','liberation','manifestation'
  )),
  text_fr TEXT NOT NULL CHECK (length(text_fr) BETWEEN 5 AND 300),
  text_en TEXT NOT NULL CHECK (length(text_en) BETWEEN 5 AND 300),
  weight SMALLINT NOT NULL DEFAULT 5 CHECK (weight BETWEEN 1 AND 10),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phrases_category ON mukti.intention_phrases(category) WHERE active = true;

-- ============================================================
-- 7. circle_replays — enregistrements audio 7j rolling (Supabase Storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.circle_replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES mukti.circles(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration_sec INTEGER NOT NULL CHECK (duration_sec >= 0),
  size_bytes BIGINT NOT NULL DEFAULT 0,
  participants_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_replays_circle ON mukti.circle_replays(circle_id);
CREATE INDEX IF NOT EXISTS idx_replays_expires ON mukti.circle_replays(expires_at);

-- ============================================================
-- 8. circle_follows — suivi entre pratiquants (mini-social)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.circle_follows (
  follower_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON mukti.circle_follows(followed_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'circles_updated_at') THEN
    CREATE TRIGGER circles_updated_at BEFORE UPDATE ON mukti.circles
      FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'circle_messages_updated_at') THEN
    CREATE TRIGGER circle_messages_updated_at BEFORE UPDATE ON mukti.circle_messages
      FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
END $$;

-- ============================================================
-- assign rotation_position incrémental à l'insert participant
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.assign_rotation_position()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_pos INTEGER;
BEGIN
  IF NEW.rotation_position IS NULL OR NEW.rotation_position = 0 THEN
    SELECT COALESCE(MAX(rotation_position), 0) + 1 INTO next_pos
      FROM mukti.circle_participants
      WHERE circle_id = NEW.circle_id;
    NEW.rotation_position = next_pos;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cp_assign_position') THEN
    CREATE TRIGGER cp_assign_position
      BEFORE INSERT ON mukti.circle_participants
      FOR EACH ROW EXECUTE FUNCTION mukti.assign_rotation_position();
  END IF;
END $$;

-- ============================================================
-- auto-start live quand participants atteint max_participants
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.maybe_start_circle_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  c RECORD;
  active_count INTEGER;
BEGIN
  SELECT * INTO c FROM mukti.circles WHERE id = NEW.circle_id FOR UPDATE;
  IF c.status <> 'open' OR NOT c.auto_start_when_full THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO active_count
    FROM mukti.circle_participants
    WHERE circle_id = NEW.circle_id AND left_at IS NULL;

  IF active_count >= c.max_participants THEN
    UPDATE mukti.circles
      SET status = 'live',
          started_at = now()
      WHERE id = NEW.circle_id;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cp_maybe_start') THEN
    CREATE TRIGGER cp_maybe_start
      AFTER INSERT ON mukti.circle_participants
      FOR EACH ROW EXECUTE FUNCTION mukti.maybe_start_circle_live();
  END IF;
END $$;

-- ============================================================
-- creator auto-joins circle as creator role
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.creator_auto_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO mukti.circle_participants (circle_id, user_id, role)
    VALUES (NEW.id, NEW.creator_id, 'creator')
    ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'circles_creator_join') THEN
    CREATE TRIGGER circles_creator_join
      AFTER INSERT ON mukti.circles
      FOR EACH ROW EXECUTE FUNCTION mukti.creator_auto_join();
  END IF;
END $$;

-- ============================================================
-- increment reactions_count helper (fonction appelée par API)
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.increment_message_reactions(message_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE mukti.circle_messages
    SET reactions_count = reactions_count + 1
    WHERE id = message_id AND deleted_at IS NULL;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE mukti.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.circle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.circle_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.circle_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.circle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.intention_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.circle_replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.circle_follows ENABLE ROW LEVEL SECURITY;

-- circles: read public if status IN (open, live, finished); write owner/service
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circles' AND policyname='circles_read_public') THEN
    CREATE POLICY circles_read_public ON mukti.circles
      FOR SELECT USING (status IN ('open','live','finished') OR creator_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circles' AND policyname='circles_insert_own') THEN
    CREATE POLICY circles_insert_own ON mukti.circles
      FOR INSERT WITH CHECK (creator_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circles' AND policyname='circles_update_creator') THEN
    CREATE POLICY circles_update_creator ON mukti.circles
      FOR UPDATE USING (creator_id = mukti.current_profile_id())
      WITH CHECK (creator_id = mukti.current_profile_id());
  END IF;
END $$;

-- circle_participants: read if participant of same circle, insert own, delete own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_participants' AND policyname='cp_read_same_circle') THEN
    CREATE POLICY cp_read_same_circle ON mukti.circle_participants
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM mukti.circle_participants cp2
          WHERE cp2.circle_id = circle_participants.circle_id
            AND cp2.user_id = mukti.current_profile_id()
        )
        OR user_id = mukti.current_profile_id()
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_participants' AND policyname='cp_insert_self') THEN
    CREATE POLICY cp_insert_self ON mukti.circle_participants
      FOR INSERT WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_participants' AND policyname='cp_update_self') THEN
    CREATE POLICY cp_update_self ON mukti.circle_participants
      FOR UPDATE USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- circle_rotations: read participant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_rotations' AND policyname='cr_read_participant') THEN
    CREATE POLICY cr_read_participant ON mukti.circle_rotations
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM mukti.circle_participants cp
          WHERE cp.circle_id = circle_rotations.circle_id
            AND cp.user_id = mukti.current_profile_id()
        )
      );
  END IF;
END $$;

-- circle_messages: read public for forum kind, read participant for session kinds
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_messages' AND policyname='cm_read') THEN
    CREATE POLICY cm_read ON mukti.circle_messages
      FOR SELECT USING (
        deleted_at IS NULL
        AND (
          kind = 'forum'
          OR EXISTS (
            SELECT 1 FROM mukti.circle_participants cp
            WHERE cp.circle_id = circle_messages.circle_id
              AND cp.user_id = mukti.current_profile_id()
          )
          OR user_id = mukti.current_profile_id()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_messages' AND policyname='cm_insert_auth') THEN
    CREATE POLICY cm_insert_auth ON mukti.circle_messages
      FOR INSERT WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_messages' AND policyname='cm_update_own') THEN
    CREATE POLICY cm_update_own ON mukti.circle_messages
      FOR UPDATE USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- circle_reports: insert auth, read service_role only (policy implicite avec bypass)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_reports' AND policyname='creports_insert_auth') THEN
    CREATE POLICY creports_insert_auth ON mukti.circle_reports
      FOR INSERT WITH CHECK (reporter_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_reports' AND policyname='creports_read_own') THEN
    CREATE POLICY creports_read_own ON mukti.circle_reports
      FOR SELECT USING (reporter_id = mukti.current_profile_id());
  END IF;
END $$;

-- intention_phrases: read public si active
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='intention_phrases' AND policyname='phrases_read_active') THEN
    CREATE POLICY phrases_read_active ON mukti.intention_phrases
      FOR SELECT USING (active = true);
  END IF;
END $$;

-- circle_replays: read participant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_replays' AND policyname='replays_read_participant') THEN
    CREATE POLICY replays_read_participant ON mukti.circle_replays
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM mukti.circle_participants cp
          WHERE cp.circle_id = circle_replays.circle_id
            AND cp.user_id = mukti.current_profile_id()
        )
      );
  END IF;
END $$;

-- circle_follows: read public, insert/delete self
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_follows' AND policyname='follows_read_public') THEN
    CREATE POLICY follows_read_public ON mukti.circle_follows
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_follows' AND policyname='follows_insert_self') THEN
    CREATE POLICY follows_insert_self ON mukti.circle_follows
      FOR INSERT WITH CHECK (follower_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='circle_follows' AND policyname='follows_delete_self') THEN
    CREATE POLICY follows_delete_self ON mukti.circle_follows
      FOR DELETE USING (follower_id = mukti.current_profile_id());
  END IF;
END $$;

-- ============================================================
-- SEED 140 phrases (10 × 14 catégories) FR + EN
-- upsert safe via ON CONFLICT DO NOTHING sur (category, text_fr)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_phrases_category_text ON mukti.intention_phrases(category, text_fr);

INSERT INTO mukti.intention_phrases (category, text_fr, text_en, weight) VALUES
  -- abondance
  ('abondance', 'Tu es soutenu(e) dans la vie.', 'You are supported by life.', 8),
  ('abondance', 'L''abondance circule vers toi, librement.', 'Abundance flows to you, freely.', 9),
  ('abondance', 'Tu mérites de recevoir.', 'You deserve to receive.', 9),
  ('abondance', 'La vie t''accompagne à chaque pas.', 'Life walks beside you every step.', 7),
  ('abondance', 'Tu es en sécurité, tu peux t''ouvrir.', 'You are safe, you can open up.', 8),
  ('abondance', 'Les bonnes choses viennent à toi naturellement.', 'Good things come to you naturally.', 8),
  ('abondance', 'Tu fais partie du flux de la vie.', 'You are part of the flow of life.', 7),
  ('abondance', 'Recevoir est aussi beau que donner.', 'Receiving is as beautiful as giving.', 7),
  ('abondance', 'L''univers prend soin de toi.', 'The universe takes care of you.', 8),
  ('abondance', 'Tu es aimé(e), tu es vu(e), tu es entendu(e).', 'You are loved, seen, and heard.', 9),
  -- amour_soi
  ('amour_soi', 'Tu es digne d''amour, simplement en étant toi.', 'You are worthy of love, simply by being you.', 10),
  ('amour_soi', 'Tu peux te reposer. Tu es assez.', 'You can rest. You are enough.', 10),
  ('amour_soi', 'Ton cœur mérite toute la douceur.', 'Your heart deserves all the softness.', 9),
  ('amour_soi', 'Tu peux être gentil(le) avec toi-même.', 'You can be kind to yourself.', 9),
  ('amour_soi', 'Chaque partie de toi est bienvenue ici.', 'Every part of you is welcome here.', 8),
  ('amour_soi', 'Tu te pardonnes, encore et encore.', 'You forgive yourself, again and again.', 9),
  ('amour_soi', 'Tu n''as rien à prouver.', 'You have nothing to prove.', 9),
  ('amour_soi', 'Ton existence est précieuse.', 'Your existence is precious.', 8),
  ('amour_soi', 'Tu respires, donc tu es aimé(e).', 'You breathe, therefore you are loved.', 7),
  ('amour_soi', 'Tu es une partie du divin.', 'You are part of the divine.', 7),
  -- apaisement
  ('apaisement', 'Tout est bien. Respire.', 'All is well. Breathe.', 10),
  ('apaisement', 'Tu peux déposer ce que tu portes.', 'You can put down what you carry.', 9),
  ('apaisement', 'Ce moment t''appartient.', 'This moment is yours.', 8),
  ('apaisement', 'Le silence est ton ami.', 'Silence is your friend.', 8),
  ('apaisement', 'Ton corps sait se calmer.', 'Your body knows how to calm down.', 9),
  ('apaisement', 'Il n''y a rien à faire, juste être.', 'There is nothing to do, just be.', 9),
  ('apaisement', 'La paix commence ici, maintenant.', 'Peace begins here, now.', 10),
  ('apaisement', 'Tes épaules peuvent se relâcher.', 'Your shoulders can relax.', 8),
  ('apaisement', 'Tu es en sécurité dans ce souffle.', 'You are safe in this breath.', 9),
  ('apaisement', 'La vague passe. Toi, tu restes.', 'The wave passes. You remain.', 8),
  -- motivation
  ('motivation', 'Tu as la force de te relever.', 'You have the strength to rise.', 9),
  ('motivation', 'Chaque petit pas compte.', 'Every small step matters.', 9),
  ('motivation', 'Ton rêve est vivant en toi.', 'Your dream is alive within you.', 8),
  ('motivation', 'Tu es plus capable que tu ne le crois.', 'You are more capable than you believe.', 9),
  ('motivation', 'Ton élan est déjà là, il attend.', 'Your momentum is here, waiting.', 7),
  ('motivation', 'Tu avances, même lentement.', 'You move forward, even slowly.', 8),
  ('motivation', 'Le feu en toi ne s''éteint pas.', 'The fire within you does not die.', 8),
  ('motivation', 'Tu mérites d''accomplir ce qui t''appelle.', 'You deserve to accomplish what calls you.', 9),
  ('motivation', 'Tu es plus fort(e) après chaque épreuve.', 'You are stronger after each trial.', 8),
  ('motivation', 'Aujourd''hui est un nouveau départ.', 'Today is a new beginning.', 9),
  -- renouveau
  ('renouveau', 'Tu peux recommencer à chaque instant.', 'You can start over any moment.', 9),
  ('renouveau', 'Ce qui meurt laisse place à ce qui naît.', 'What dies makes room for what is born.', 8),
  ('renouveau', 'Tu es un cycle qui se renouvelle.', 'You are a cycle that renews itself.', 8),
  ('renouveau', 'L''ancien s''efface pour le nouveau.', 'The old fades for the new.', 7),
  ('renouveau', 'Tu te redécouvres chaque jour.', 'You rediscover yourself each day.', 8),
  ('renouveau', 'La vie te repousse vers le haut.', 'Life pushes you upward.', 7),
  ('renouveau', 'Ton printemps intérieur arrive.', 'Your inner spring is coming.', 8),
  ('renouveau', 'Tu te libères de ce qui pèse.', 'You free yourself from what weighs you down.', 8),
  ('renouveau', 'Ta lumière renaît à chaque aube.', 'Your light is reborn at every dawn.', 8),
  ('renouveau', 'Tu es en chemin vers toi-même.', 'You are on the path to yourself.', 9),
  -- confiance
  ('confiance', 'Tu sais. Au fond de toi, tu sais.', 'You know. Deep down, you know.', 9),
  ('confiance', 'Ta voix intérieure est juste.', 'Your inner voice is right.', 9),
  ('confiance', 'Tu peux te faire confiance.', 'You can trust yourself.', 10),
  ('confiance', 'Tes choix sont valides.', 'Your choices are valid.', 8),
  ('confiance', 'Tu es à ta juste place.', 'You are in your rightful place.', 9),
  ('confiance', 'Ton intuition te guide avec justesse.', 'Your intuition guides you rightly.', 8),
  ('confiance', 'Tu es digne d''être entendu(e).', 'You are worthy of being heard.', 8),
  ('confiance', 'Tu n''as pas besoin de l''approbation.', 'You don''t need approval.', 8),
  ('confiance', 'Ta vérité compte.', 'Your truth matters.', 9),
  ('confiance', 'Tu es enraciné(e) dans ton pouvoir.', 'You are rooted in your power.', 8),
  -- protection
  ('protection', 'Tu es entouré(e) de lumière bienveillante.', 'You are surrounded by gentle light.', 9),
  ('protection', 'Rien ne peut t''atteindre sans ton accord.', 'Nothing can reach you without your consent.', 8),
  ('protection', 'Ton espace est sacré.', 'Your space is sacred.', 9),
  ('protection', 'Tu peux poser des limites saines.', 'You can set healthy boundaries.', 9),
  ('protection', 'Tu es gardé(e) par quelque chose de plus grand.', 'You are guarded by something greater.', 7),
  ('protection', 'Ton énergie t''appartient.', 'Your energy is yours.', 8),
  ('protection', 'Tu peux dire non sans te justifier.', 'You can say no without explaining.', 9),
  ('protection', 'Tu es en paix, même au milieu du chaos.', 'You are at peace, even in chaos.', 8),
  ('protection', 'Ta vulnérabilité est ta force.', 'Your vulnerability is your strength.', 8),
  ('protection', 'Tu es à l''abri, à l''intérieur.', 'You are safe, within.', 8),
  -- alignement
  ('alignement', 'Tu es aligné(e) avec ta vérité.', 'You are aligned with your truth.', 9),
  ('alignement', 'Ton chemin s''éclaire à mesure que tu avances.', 'Your path lights up as you move.', 8),
  ('alignement', 'Tu es en résonance avec ce qui te correspond.', 'You resonate with what matches you.', 8),
  ('alignement', 'Ton corps, ton cœur, ton esprit — unis.', 'Your body, heart, mind — united.', 9),
  ('alignement', 'Tu incarnes qui tu es vraiment.', 'You embody who you truly are.', 9),
  ('alignement', 'La vie te répond quand tu es aligné(e).', 'Life responds when you are aligned.', 7),
  ('alignement', 'Tu ne te trahis plus.', 'You no longer betray yourself.', 9),
  ('alignement', 'Ton "oui" et ton "non" sont clairs.', 'Your "yes" and "no" are clear.', 8),
  ('alignement', 'Tu respectes ton rythme.', 'You honor your rhythm.', 8),
  ('alignement', 'Tu es fidèle à toi-même.', 'You are true to yourself.', 9),
  -- paix
  ('paix', 'La paix est déjà en toi.', 'Peace is already within you.', 10),
  ('paix', 'Tu peux te reposer dans ce qui est.', 'You can rest in what is.', 9),
  ('paix', 'Rien n''est urgent dans ce souffle.', 'Nothing is urgent in this breath.', 9),
  ('paix', 'La douceur est ton lieu.', 'Softness is your home.', 8),
  ('paix', 'Tout est juste tel que c''est.', 'Everything is right as it is.', 8),
  ('paix', 'Tu n''as pas besoin de combattre.', 'You don''t need to fight.', 9),
  ('paix', 'Ton silence intérieur est ton trésor.', 'Your inner silence is your treasure.', 8),
  ('paix', 'La paix ne te quitte jamais vraiment.', 'Peace never truly leaves you.', 8),
  ('paix', 'Tu es la paix que tu cherches.', 'You are the peace you seek.', 10),
  ('paix', 'Ici. Maintenant. C''est suffisant.', 'Here. Now. This is enough.', 9),
  -- ancrage
  ('ancrage', 'Tu es relié(e) à la terre.', 'You are rooted in the earth.', 9),
  ('ancrage', 'Tes pieds savent où te porter.', 'Your feet know where to carry you.', 8),
  ('ancrage', 'Ton corps est ta maison.', 'Your body is your home.', 9),
  ('ancrage', 'Tu es présent(e), maintenant.', 'You are present, now.', 9),
  ('ancrage', 'Tu habites ton souffle.', 'You inhabit your breath.', 8),
  ('ancrage', 'La gravité te soutient.', 'Gravity holds you.', 7),
  ('ancrage', 'Tu n''as pas à flotter, tu peux atterrir.', 'You don''t have to float, you can land.', 8),
  ('ancrage', 'Ta stabilité vient de l''intérieur.', 'Your stability comes from within.', 8),
  ('ancrage', 'Tu es enraciné(e) et vivant(e).', 'You are rooted and alive.', 8),
  ('ancrage', 'Chaque respiration t''ancre.', 'Each breath anchors you.', 9),
  -- clarte
  ('clarte', 'Tes pensées s''éclaircissent.', 'Your thoughts clear up.', 8),
  ('clarte', 'Tu vois ce qui est juste pour toi.', 'You see what is right for you.', 9),
  ('clarte', 'La vérité se dévoile à toi.', 'Truth reveals itself to you.', 8),
  ('clarte', 'Tu sais ce que tu dois faire.', 'You know what you need to do.', 9),
  ('clarte', 'Ton esprit devient limpide.', 'Your mind becomes clear.', 8),
  ('clarte', 'Les réponses arrivent en leur temps.', 'Answers arrive in their time.', 8),
  ('clarte', 'Tu discernes ce qui te nourrit.', 'You discern what nourishes you.', 8),
  ('clarte', 'Tes priorités t''apparaissent.', 'Your priorities appear.', 7),
  ('clarte', 'Tu n''as plus besoin de tout contrôler.', 'You no longer need to control everything.', 8),
  ('clarte', 'La lumière traverse le doute.', 'Light moves through doubt.', 8),
  -- gratitude
  ('gratitude', 'Merci, simplement, merci.', 'Thank you, simply, thank you.', 10),
  ('gratitude', 'Ton cœur est plein de ce qui est.', 'Your heart is full of what is.', 8),
  ('gratitude', 'Tu reconnais les petites choses.', 'You recognize the small things.', 9),
  ('gratitude', 'La gratitude ouvre ton monde.', 'Gratitude opens your world.', 9),
  ('gratitude', 'Tu es en vie. C''est beaucoup.', 'You are alive. That is much.', 10),
  ('gratitude', 'Tout ce que tu as est suffisant, maintenant.', 'All you have is enough, now.', 9),
  ('gratitude', 'Tu remercies ton corps.', 'You thank your body.', 8),
  ('gratitude', 'Tu remercies ton histoire.', 'You thank your story.', 8),
  ('gratitude', 'Ton souffle est un cadeau.', 'Your breath is a gift.', 9),
  ('gratitude', 'La vie te traverse, tu la remercies.', 'Life moves through you, you thank it.', 8),
  -- liberation
  ('liberation', 'Tu es libre de ce qui n''est plus toi.', 'You are free from what is no longer you.', 10),
  ('liberation', 'Tu laisses partir ce qui doit partir.', 'You let go of what must go.', 9),
  ('liberation', 'Les chaînes tombent, une à une.', 'The chains fall, one by one.', 9),
  ('liberation', 'Tu te choisis, enfin.', 'You choose yourself, at last.', 10),
  ('liberation', 'Tu n''es pas ton passé.', 'You are not your past.', 10),
  ('liberation', 'Ta liberté ne dépend de personne.', 'Your freedom depends on no one.', 9),
  ('liberation', 'Tu t''affranchis, en douceur.', 'You free yourself, gently.', 9),
  ('liberation', 'Ce qui te retenait perd son pouvoir.', 'What held you back loses its power.', 9),
  ('liberation', 'Tu respires large.', 'You breathe wide.', 8),
  ('liberation', 'Tu avances, léger(e).', 'You move forward, lightly.', 8),
  -- manifestation
  ('manifestation', 'Ce que tu appelles vient à toi.', 'What you call comes to you.', 8),
  ('manifestation', 'Ta vision prend forme.', 'Your vision takes shape.', 9),
  ('manifestation', 'Tu es le créateur de ta réalité.', 'You are the creator of your reality.', 9),
  ('manifestation', 'Tes rêves sont déjà en chemin.', 'Your dreams are already on their way.', 9),
  ('manifestation', 'Tu incarnes ce que tu désires devenir.', 'You embody what you wish to become.', 9),
  ('manifestation', 'L''univers conspire pour toi.', 'The universe conspires for you.', 8),
  ('manifestation', 'Ton intention est puissante.', 'Your intention is powerful.', 9),
  ('manifestation', 'Tu attires ce qui te ressemble.', 'You attract what resembles you.', 8),
  ('manifestation', 'Tes graines poussent dans le silence.', 'Your seeds grow in silence.', 8),
  ('manifestation', 'Tu es aligné(e) avec l''accomplissement.', 'You are aligned with fulfillment.', 8)
ON CONFLICT (category, text_fr) DO NOTHING;

-- ============================================================
-- PostgREST reload (NOTIFY PGRST 'reload schema')
-- ============================================================
NOTIFY pgrst, 'reload schema';

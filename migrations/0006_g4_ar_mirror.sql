-- ============================================================
-- MUKTI — G4 AR Energy Mirror
-- Migration 0006 : 7 tables + RLS + helper SECURITY DEFINER
--   + seed 7 espèces + 20 beacons + 3 cérémonies Moment Z
-- Patterns alignés G1+G2+G3 : schema mukti, user_id → mukti.profiles(id),
-- idempotent IF NOT EXISTS, RLS via mukti.current_profile_id(),
-- updated_at via mukti.set_updated_at() (G1).
-- ============================================================

SET search_path = mukti, public;

-- ============================================================
-- 1. ar_species_catalog — 7 transformations (humain + 6 animales)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ar_species_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug IN (
    'humain','chien','chat','cheval','oiseau','faune_sauvage','gardien_refuge'
  )),
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  rig_type TEXT NOT NULL CHECK (rig_type IN ('biped','quadruped','avian','guardian')),
  energy_color TEXT NOT NULL CHECK (energy_color ~ '^#[0-9A-Fa-f]{6}$'),
  icon_glyph TEXT NOT NULL,
  description_fr TEXT NOT NULL CHECK (length(description_fr) BETWEEN 10 AND 300),
  description_en TEXT NOT NULL CHECK (length(description_en) BETWEEN 10 AND 300),
  sort_order INTEGER NOT NULL DEFAULT 100,
  locked BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ar_species_active ON mukti.ar_species_catalog(sort_order) WHERE active = true;

-- ============================================================
-- 2. ar_beacons — 20 cibles de rayon (refuges, ONG, éléments)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ar_beacons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9_]{2,64}$'),
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('refuge_animalier','ong_nature','personne','planete','element')),
  latitude NUMERIC(8,5),
  longitude NUMERIC(8,5),
  image_url TEXT,
  description_fr TEXT NOT NULL CHECK (length(description_fr) BETWEEN 10 AND 500),
  description_en TEXT NOT NULL CHECK (length(description_en) BETWEEN 10 AND 500),
  intention_hint TEXT CHECK (intention_hint IN (
    'abondance','amour_soi','apaisement','motivation','renouveau',
    'confiance','protection','alignement','paix','ancrage',
    'clarte','gratitude','liberation','manifestation'
  )),
  sort_order INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ar_beacons_type ON mukti.ar_beacons(type) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_ar_beacons_intent ON mukti.ar_beacons(intention_hint) WHERE active = true;

-- ============================================================
-- 3. ar_calibrations — skeleton proportions par user (1 ligne/user)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ar_calibrations (
  user_id UUID PRIMARY KEY REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  shoulder_width NUMERIC(6,4) NOT NULL CHECK (shoulder_width > 0 AND shoulder_width <= 2),
  torso_length NUMERIC(6,4) NOT NULL CHECK (torso_length > 0 AND torso_length <= 2),
  arm_span NUMERIC(6,4) NOT NULL CHECK (arm_span > 0 AND arm_span <= 3),
  hip_width NUMERIC(6,4) NOT NULL CHECK (hip_width > 0 AND hip_width <= 2),
  calibration_quality TEXT NOT NULL DEFAULT 'medium' CHECK (calibration_quality IN ('low','medium','high')),
  calibration_frames INTEGER NOT NULL DEFAULT 30 CHECK (calibration_frames BETWEEN 1 AND 1000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. ar_sessions — historique sessions AR
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ar_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('soin','manifestation','ceremony','training')),
  species_slug TEXT REFERENCES mukti.ar_species_catalog(slug) ON DELETE SET NULL,
  beacon_slug TEXT REFERENCES mukti.ar_beacons(slug) ON DELETE SET NULL,
  ceremony_id UUID,
  duration_sec INTEGER NOT NULL DEFAULT 0 CHECK (duration_sec >= 0 AND duration_sec <= 7200),
  intensity_1_5 SMALLINT CHECK (intensity_1_5 IS NULL OR intensity_1_5 BETWEEN 1 AND 5),
  fallback_imaginary BOOLEAN NOT NULL DEFAULT false,
  completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_user ON mukti.ar_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_mode ON mukti.ar_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_ceremony ON mukti.ar_sessions(ceremony_id) WHERE ceremony_id IS NOT NULL;

-- ============================================================
-- 5. ar_ceremonies — Moments Z planifiés (Realtime sync à la seconde)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ar_ceremonies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  intention_category TEXT NOT NULL CHECK (intention_category IN (
    'abondance','amour_soi','apaisement','motivation','renouveau',
    'confiance','protection','alignement','paix','ancrage',
    'clarte','gratitude','liberation','manifestation'
  )),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 600 CHECK (duration_sec BETWEEN 60 AND 3600),
  species_hint TEXT REFERENCES mukti.ar_species_catalog(slug) ON DELETE SET NULL,
  beacon_slug TEXT REFERENCES mukti.ar_beacons(slug) ON DELETE SET NULL,
  max_participants INTEGER NOT NULL DEFAULT 10000 CHECK (max_participants BETWEEN 2 AND 1000000),
  creator_id UUID REFERENCES mukti.profiles(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('weekly_monday_06','weekly_wednesday_20','weekly_sunday_18')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','finished','cancelled')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ar_ceremonies_scheduled ON mukti.ar_ceremonies(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ar_ceremonies_status ON mukti.ar_ceremonies(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ar_ceremonies_upcoming ON mukti.ar_ceremonies(scheduled_at) WHERE status IN ('upcoming','live');

-- FK ar_sessions.ceremony_id → ar_ceremonies(id) (ajoutée après création table)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ar_sessions_ceremony_id_fkey'
  ) THEN
    ALTER TABLE mukti.ar_sessions
      ADD CONSTRAINT ar_sessions_ceremony_id_fkey
      FOREIGN KEY (ceremony_id) REFERENCES mukti.ar_ceremonies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 6. ar_ceremony_participants — count live + participation
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ar_ceremony_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceremony_id UUID NOT NULL REFERENCES mukti.ar_ceremonies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  UNIQUE (ceremony_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ar_cp_ceremony ON mukti.ar_ceremony_participants(ceremony_id);
CREATE INDEX IF NOT EXISTS idx_ar_cp_user ON mukti.ar_ceremony_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_ar_cp_active ON mukti.ar_ceremony_participants(ceremony_id) WHERE left_at IS NULL;

-- ============================================================
-- 7. ar_training_progress — tuto Soin + Manifestation (5 étapes × 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS mukti.ar_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES mukti.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('soin','manifestation')),
  step SMALLINT NOT NULL CHECK (step BETWEEN 1 AND 5),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mode, step)
);
CREATE INDEX IF NOT EXISTS idx_ar_training_user ON mukti.ar_training_progress(user_id);

-- ============================================================
-- TRIGGERS set_updated_at (mukti.set_updated_at() défini G1)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ar_calibrations_updated_at') THEN
    CREATE TRIGGER ar_calibrations_updated_at
      BEFORE UPDATE ON mukti.ar_calibrations
      FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ar_ceremonies_updated_at') THEN
    CREATE TRIGGER ar_ceremonies_updated_at
      BEFORE UPDATE ON mukti.ar_ceremonies
      FOR EACH ROW EXECUTE FUNCTION mukti.set_updated_at();
  END IF;
END $$;

-- ============================================================
-- TRIGGER creator auto-joins ceremony (participants)
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.ar_ceremony_creator_auto_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.creator_id IS NOT NULL THEN
    INSERT INTO mukti.ar_ceremony_participants (ceremony_id, user_id)
      VALUES (NEW.id, NEW.creator_id)
      ON CONFLICT (ceremony_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ar_ceremony_creator_join') THEN
    CREATE TRIGGER ar_ceremony_creator_join
      AFTER INSERT ON mukti.ar_ceremonies
      FOR EACH ROW EXECUTE FUNCTION mukti.ar_ceremony_creator_auto_join();
  END IF;
END $$;

-- ============================================================
-- HELPER SECURITY DEFINER : ar_in_ceremony(ceremony_id, user_id) → bool
-- Bypass RLS pour les policies qui veulent vérifier l'appartenance
-- sans créer de récursion (même pattern G3 user_in_circle).
-- ============================================================
CREATE OR REPLACE FUNCTION mukti.ar_in_ceremony(p_ceremony_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mukti, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM mukti.ar_ceremony_participants
    WHERE ceremony_id = p_ceremony_id
      AND user_id = p_user_id
      AND left_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION mukti.ar_in_ceremony(UUID, UUID) TO anon, authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE mukti.ar_species_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.ar_beacons ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.ar_calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.ar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.ar_ceremonies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.ar_ceremony_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mukti.ar_training_progress ENABLE ROW LEVEL SECURITY;

-- ar_species_catalog : lecture publique (actif), écriture service uniquement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_species_catalog' AND policyname='ar_species_read_public') THEN
    CREATE POLICY ar_species_read_public ON mukti.ar_species_catalog
      FOR SELECT USING (active = true);
  END IF;
END $$;

-- ar_beacons : lecture publique (actif), écriture service uniquement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_beacons' AND policyname='ar_beacons_read_public') THEN
    CREATE POLICY ar_beacons_read_public ON mukti.ar_beacons
      FOR SELECT USING (active = true);
  END IF;
END $$;

-- ar_calibrations : 1 ligne/user, propre uniquement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_calibrations' AND policyname='ar_calib_own_read') THEN
    CREATE POLICY ar_calib_own_read ON mukti.ar_calibrations
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_calibrations' AND policyname='ar_calib_own_insert') THEN
    CREATE POLICY ar_calib_own_insert ON mukti.ar_calibrations
      FOR INSERT WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_calibrations' AND policyname='ar_calib_own_update') THEN
    CREATE POLICY ar_calib_own_update ON mukti.ar_calibrations
      FOR UPDATE USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- ar_sessions : lecture + écriture propres uniquement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_sessions' AND policyname='ar_sessions_own_read') THEN
    CREATE POLICY ar_sessions_own_read ON mukti.ar_sessions
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_sessions' AND policyname='ar_sessions_own_insert') THEN
    CREATE POLICY ar_sessions_own_insert ON mukti.ar_sessions
      FOR INSERT WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_sessions' AND policyname='ar_sessions_own_update') THEN
    CREATE POLICY ar_sessions_own_update ON mukti.ar_sessions
      FOR UPDATE USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- ar_ceremonies : read public upcoming/live/finished, write creator
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_ceremonies' AND policyname='ar_cer_read_public') THEN
    CREATE POLICY ar_cer_read_public ON mukti.ar_ceremonies
      FOR SELECT USING (
        status IN ('upcoming','live','finished')
        OR creator_id = mukti.current_profile_id()
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_ceremonies' AND policyname='ar_cer_insert_own') THEN
    CREATE POLICY ar_cer_insert_own ON mukti.ar_ceremonies
      FOR INSERT WITH CHECK (creator_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_ceremonies' AND policyname='ar_cer_update_creator') THEN
    CREATE POLICY ar_cer_update_creator ON mukti.ar_ceremonies
      FOR UPDATE USING (creator_id = mukti.current_profile_id())
      WITH CHECK (creator_id = mukti.current_profile_id());
  END IF;
END $$;

-- ar_ceremony_participants : read via helper SECURITY DEFINER (anti-récursion), write own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_ceremony_participants' AND policyname='ar_cp_read_public') THEN
    CREATE POLICY ar_cp_read_public ON mukti.ar_ceremony_participants
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_ceremony_participants' AND policyname='ar_cp_insert_own') THEN
    CREATE POLICY ar_cp_insert_own ON mukti.ar_ceremony_participants
      FOR INSERT WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_ceremony_participants' AND policyname='ar_cp_update_own') THEN
    CREATE POLICY ar_cp_update_own ON mukti.ar_ceremony_participants
      FOR UPDATE USING (user_id = mukti.current_profile_id())
      WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- ar_training_progress : propre uniquement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_training_progress' AND policyname='ar_train_own_read') THEN
    CREATE POLICY ar_train_own_read ON mukti.ar_training_progress
      FOR SELECT USING (user_id = mukti.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mukti' AND tablename='ar_training_progress' AND policyname='ar_train_own_insert') THEN
    CREATE POLICY ar_train_own_insert ON mukti.ar_training_progress
      FOR INSERT WITH CHECK (user_id = mukti.current_profile_id());
  END IF;
END $$;

-- ============================================================
-- SEED 1 : 7 espèces
-- ============================================================
INSERT INTO mukti.ar_species_catalog (slug, name_fr, name_en, rig_type, energy_color, icon_glyph, description_fr, description_en, sort_order)
VALUES
  ('humain','Humain','Human','biped','#7C3AED','🧘','Ta silhouette lumineuse, fil conducteur de ton intention.','Your luminous silhouette, the thread carrying your intention.',10),
  ('chien','Chien','Dog','quadruped','#F59E0B','🐕','Le fidèle : loyauté, présence, protection du foyer.','The faithful one: loyalty, presence, home protection.',20),
  ('chat','Chat','Cat','quadruped','#06B6D4','🐈','L''intuitif : souplesse, indépendance, lecture des énergies subtiles.','The intuitive one: flexibility, independence, reading subtle energies.',30),
  ('cheval','Cheval','Horse','quadruped','#EF4444','🐎','Le libre : puissance, liberté, élan vital retrouvé.','The free one: power, freedom, reclaimed life force.',40),
  ('oiseau','Oiseau','Bird','avian','#10B981','🕊️','L''élévation : perspective, messages, voyage entre les mondes.','The elevated one: perspective, messages, travel between worlds.',50),
  ('faune_sauvage','Faune sauvage','Wildlife','quadruped','#8B5CF6','🦊','L''indomptable : instinct pur, connexion aux cycles de la Terre.','The untamed one: pure instinct, connection to Earth cycles.',60),
  ('gardien_refuge','Gardien·ne de refuge','Sanctuary Guardian','guardian','#14B8A6','🌿','Le·la gardien·ne : veille sur les vivants, ancre la paix.','The guardian: watches over the living, anchors peace.',70)
ON CONFLICT (slug) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  name_en = EXCLUDED.name_en,
  rig_type = EXCLUDED.rig_type,
  energy_color = EXCLUDED.energy_color,
  icon_glyph = EXCLUDED.icon_glyph,
  description_fr = EXCLUDED.description_fr,
  description_en = EXCLUDED.description_en,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- SEED 2 : 20 beacons (refuges animaliers + ONG nature + éléments)
-- ============================================================
INSERT INTO mukti.ar_beacons (slug, name_fr, name_en, type, latitude, longitude, image_url, description_fr, description_en, intention_hint, sort_order)
VALUES
  -- Refuges animaliers (6)
  ('spa_france','SPA France','SPA France','refuge_animalier',48.85661,2.35222,NULL,'Société Protectrice des Animaux — réseau refuges en France, protection chiens et chats abandonnés.','Society for the Protection of Animals — shelter network in France, protecting abandoned dogs and cats.','amour_soi',10),
  ('refuge_helpus','Refuge Helpus','Helpus Shelter','refuge_animalier',48.76000,2.42000,NULL,'Refuge pour animaux abandonnés en région parisienne, soins et adoption.','Shelter for abandoned animals near Paris, care and adoption.','protection',20),
  ('asso_30_millions','30 Millions d''Amis','30 Million Friends','refuge_animalier',48.85000,2.34000,NULL,'Fondation française de protection animale, refuges et lutte contre la maltraitance.','French animal protection foundation, shelters and fight against abuse.','protection',30),
  ('refuge_equides_sebastopol','Refuge Équidés Sébastopol','Sebastopol Equine Sanctuary','refuge_animalier',46.60000,2.50000,NULL,'Sanctuaire pour chevaux rescapés, retraités d''exploitation ou maltraités.','Sanctuary for rescued horses, retired from work or mistreated.','liberation',40),
  ('lpo_oiseaux','LPO Ligue pour la Protection des Oiseaux','LPO Bird Protection League','refuge_animalier',46.16000,-1.15000,NULL,'Association française de protection des oiseaux et de la biodiversité.','French bird and biodiversity protection association.','paix',50),
  ('refuge_asinerie','Asinerie du Vallon','Donkey Sanctuary','refuge_animalier',44.50000,4.00000,NULL,'Refuge pour ânes et équidés âgés — retraite paisible garantie.','Sanctuary for elderly donkeys and equids — peaceful retirement guaranteed.','apaisement',60),
  -- ONG nature (6)
  ('wwf_amazonie','WWF Amazonie','WWF Amazon','ong_nature',-3.46500,-62.21500,NULL,'Protection de la forêt amazonienne et des peuples autochtones.','Protection of the Amazon rainforest and indigenous peoples.','ancrage',70),
  ('wwf_oceans','WWF Océans','WWF Oceans','ong_nature',0.00000,-160.00000,NULL,'Protection des écosystèmes marins et de la biodiversité océanique.','Protection of marine ecosystems and ocean biodiversity.','clarte',80),
  ('sea_shepherd','Sea Shepherd','Sea Shepherd','ong_nature',-35.00000,175.00000,NULL,'Défense directe des espèces marines menacées.','Direct defense of threatened marine species.','protection',90),
  ('wwf_arctique','WWF Arctique','WWF Arctic','ong_nature',75.00000,0.00000,NULL,'Protection des ours polaires et de la banquise.','Protection of polar bears and the ice cap.','renouveau',100),
  ('wwf_afrique','WWF Afrique','WWF Africa','ong_nature',-1.28600,36.81700,NULL,'Protection de la faune sauvage africaine, éléphants, lions, rhinocéros.','Protection of African wildlife, elephants, lions, rhinos.','confiance',110),
  ('reforestation_sahel','Reforestation Sahel','Sahel Reforestation','ong_nature',14.49700,-4.22500,NULL,'Grande Muraille Verte — reforestation du Sahel pour lutter contre la désertification.','Great Green Wall — Sahel reforestation to fight desertification.','manifestation',120),
  -- Éléments / entités non-géolocalisées (8)
  ('planete_terre','Planète Terre','Planet Earth','planete',NULL,NULL,NULL,'La Terre entière, vaisseau commun de tout le vivant.','Earth itself, common vessel of all living beings.','gratitude',200),
  ('ocean_global','Océan global','Global Ocean','element',NULL,NULL,NULL,'L''océan-monde, poumon bleu et berceau de la vie.','The world ocean, blue lung and cradle of life.','paix',210),
  ('forets_anciennes','Forêts anciennes','Ancient Forests','element',NULL,NULL,NULL,'Les forêts primaires — mémoire vivante de la planète.','Primary forests — living memory of the planet.','ancrage',220),
  ('abeilles_pollinisateurs','Abeilles & pollinisateurs','Bees & Pollinators','element',NULL,NULL,NULL,'Les insectes qui tissent la vie — abeilles, papillons, bourdons.','Insects that weave life — bees, butterflies, bumblebees.','alignement',230),
  ('animaux_errants','Tous les animaux errants','All Wandering Animals','element',NULL,NULL,NULL,'Les sans-voix : animaux abandonnés, livrés aux rues, oubliés.','The voiceless: abandoned animals, left on streets, forgotten.','amour_soi',240),
  ('fonds_marins','Fonds marins profonds','Deep Sea','element',NULL,NULL,NULL,'Les abysses et leurs créatures — mystère et résilience.','The abyss and its creatures — mystery and resilience.','clarte',250),
  ('zones_conflit','Zones de conflit','Conflict Zones','element',NULL,NULL,NULL,'Les territoires traversés par la guerre — humains, animaux, Terre blessée.','Territories crossed by war — humans, animals, wounded Earth.','paix',260),
  ('proches_souffrance','Un·e proche en souffrance','A Loved One in Pain','personne',NULL,NULL,NULL,'Pense à quelqu''un que tu aimes qui traverse une épreuve.','Think of someone you love going through a hardship.','amour_soi',270)
ON CONFLICT (slug) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  name_en = EXCLUDED.name_en,
  type = EXCLUDED.type,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  description_fr = EXCLUDED.description_fr,
  description_en = EXCLUDED.description_en,
  intention_hint = EXCLUDED.intention_hint,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- SEED 3 : 3 cérémonies Moment Z hebdo (prochaine occurrence)
--   Lundi 06:00 UTC — Soin Planète
--   Mercredi 20:00 UTC — Faune Sauvage
--   Dimanche 18:00 UTC — Paix Universelle
-- ============================================================
WITH next_dates AS (
  SELECT
    -- prochain lundi 06:00 UTC
    (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '6 hours')::timestamptz
      + CASE WHEN (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '6 hours') AT TIME ZONE 'UTC' <= now()
             THEN interval '7 days' ELSE interval '0 days' END AS next_monday,
    -- prochain mercredi 20:00 UTC
    (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '2 days' + interval '20 hours')::timestamptz
      + CASE WHEN (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '2 days' + interval '20 hours') AT TIME ZONE 'UTC' <= now()
             THEN interval '7 days' ELSE interval '0 days' END AS next_wednesday,
    -- prochain dimanche 18:00 UTC
    (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '6 days' + interval '18 hours')::timestamptz
      + CASE WHEN (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '6 days' + interval '18 hours') AT TIME ZONE 'UTC' <= now()
             THEN interval '7 days' ELSE interval '0 days' END AS next_sunday
)
INSERT INTO mukti.ar_ceremonies (slug, title, description, intention_category, scheduled_at, duration_sec, species_hint, beacon_slug, max_participants, creator_id, is_system, recurrence_rule, status)
SELECT 'seed_soin_planete_hebdo','Soin à la Planète','Cérémonie hebdomadaire dédiée à la Terre. 10 minutes de présence synchrone pour envoyer soin et gratitude au vivant.','gratitude',next_monday,600,'gardien_refuge','planete_terre',100000,NULL,true,'weekly_monday_06','upcoming' FROM next_dates
ON CONFLICT (slug) DO UPDATE SET
  scheduled_at = EXCLUDED.scheduled_at,
  status = CASE WHEN mukti.ar_ceremonies.status IN ('finished','cancelled') THEN 'upcoming' ELSE mukti.ar_ceremonies.status END;

WITH next_dates AS (
  SELECT
    (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '2 days' + interval '20 hours')::timestamptz
      + CASE WHEN (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '2 days' + interval '20 hours') AT TIME ZONE 'UTC' <= now()
             THEN interval '7 days' ELSE interval '0 days' END AS next_wednesday
)
INSERT INTO mukti.ar_ceremonies (slug, title, description, intention_category, scheduled_at, duration_sec, species_hint, beacon_slug, max_participants, creator_id, is_system, recurrence_rule, status)
SELECT 'seed_faune_sauvage_hebdo','Cercle Faune Sauvage','10 minutes ensemble pour toutes les créatures sauvages : forêts, océans, savanes, pôles.','protection',next_wednesday,600,'faune_sauvage','wwf_amazonie',100000,NULL,true,'weekly_wednesday_20','upcoming' FROM next_dates
ON CONFLICT (slug) DO UPDATE SET
  scheduled_at = EXCLUDED.scheduled_at,
  status = CASE WHEN mukti.ar_ceremonies.status IN ('finished','cancelled') THEN 'upcoming' ELSE mukti.ar_ceremonies.status END;

WITH next_dates AS (
  SELECT
    (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '6 days' + interval '18 hours')::timestamptz
      + CASE WHEN (date_trunc('week', now() AT TIME ZONE 'UTC')::timestamp + interval '6 days' + interval '18 hours') AT TIME ZONE 'UTC' <= now()
             THEN interval '7 days' ELSE interval '0 days' END AS next_sunday
)
INSERT INTO mukti.ar_ceremonies (slug, title, description, intention_category, scheduled_at, duration_sec, species_hint, beacon_slug, max_participants, creator_id, is_system, recurrence_rule, status)
SELECT 'seed_paix_universelle_hebdo','Paix Universelle','10 minutes de paix synchrone à travers le monde. Tous ensemble, peu importe la distance.','paix',next_sunday,600,'humain','zones_conflit',100000,NULL,true,'weekly_sunday_18','upcoming' FROM next_dates
ON CONFLICT (slug) DO UPDATE SET
  scheduled_at = EXCLUDED.scheduled_at,
  status = CASE WHEN mukti.ar_ceremonies.status IN ('finished','cancelled') THEN 'upcoming' ELSE mukti.ar_ceremonies.status END;

-- ============================================================
-- GRANTS rôles PostgREST (anon / authenticated / service_role)
-- ============================================================
GRANT USAGE ON SCHEMA mukti TO anon, authenticated, service_role;
GRANT SELECT ON mukti.ar_species_catalog TO anon, authenticated;
GRANT SELECT ON mukti.ar_beacons TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON mukti.ar_calibrations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON mukti.ar_sessions TO authenticated;
GRANT SELECT ON mukti.ar_ceremonies TO anon, authenticated;
GRANT INSERT, UPDATE ON mukti.ar_ceremonies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON mukti.ar_ceremony_participants TO authenticated;
GRANT SELECT ON mukti.ar_ceremony_participants TO anon;
GRANT SELECT, INSERT ON mukti.ar_training_progress TO authenticated;
GRANT ALL ON mukti.ar_species_catalog TO service_role;
GRANT ALL ON mukti.ar_beacons TO service_role;
GRANT ALL ON mukti.ar_calibrations TO service_role;
GRANT ALL ON mukti.ar_sessions TO service_role;
GRANT ALL ON mukti.ar_ceremonies TO service_role;
GRANT ALL ON mukti.ar_ceremony_participants TO service_role;
GRANT ALL ON mukti.ar_training_progress TO service_role;

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';

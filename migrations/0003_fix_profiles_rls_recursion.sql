-- Fix vida_aide.profiles RLS infinite recursion (PostgreSQL error 42P17).
--
-- Bug : la policy profiles_select_own contient un sous-SELECT sur
-- vida_aide.profiles, ce qui re-déclenche RLS et crée une boucle. Tous les
-- non-super_admin reçoivent un 500 PostgREST en lisant leur profil.
--
-- Fix : on remplace la sous-requête par un appel à une fonction
-- SECURITY DEFINER qui bypasse RLS pour vérifier le rôle super_admin.

CREATE OR REPLACE FUNCTION vida_aide.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vida_aide.profiles
    WHERE auth_user_id = auth.uid() AND role = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION vida_aide.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vida_aide.is_super_admin() TO anon, authenticated;

DROP POLICY IF EXISTS profiles_select_own ON vida_aide.profiles;
CREATE POLICY profiles_select_own ON vida_aide.profiles FOR SELECT
  USING (auth.uid() = auth_user_id OR vida_aide.is_super_admin());

NOTIFY pgrst, 'reload schema';

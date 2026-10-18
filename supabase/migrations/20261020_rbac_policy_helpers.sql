-- Break recursive profile-policy lookups by resolving the signed-in user's
-- role/campus through tightly-scoped SECURITY DEFINER helper functions.
BEGIN;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off
AS $$ SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.current_app_campus_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off
AS $$ SELECT p.campus_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1 $$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_campus_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_campus_id() TO authenticated;

DROP POLICY IF EXISTS "Users read own or campus profiles" ON public.profiles;
CREATE POLICY "Users read own or campus profiles" ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id OR
  public.current_app_role() = 'super_admin' OR
  (public.current_app_role() IN ('campus_admin','teacher') AND campus_id = public.current_app_campus_id())
);

COMMIT;

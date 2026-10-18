-- ====================================================================
-- LearnQuest: Campus RBAC + Leaderboard RPC
-- File: supabase/migrations/20261016_campus_rbac_leaderboard.sql
--
-- What this migration does:
--   1. Creates the `campuses` table if it does not already exist.
--   2. Adds `campus_id`, `role`, `last_activity_date`, `updated_at`
--      columns to `profiles` if missing.
--   3. Updates RLS on `profiles` so campus staff can read their campus
--      members, and super_admins can read all.
--   4. Creates `get_leaderboard_with_avatars()` RPC used by /leaderboard.
--
-- Safety:
--   - All DDL is additive (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
--   - Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
--   - Does NOT drop or truncate any existing tables or data.
--   - Preserves all existing user XP, levels, streaks, and attempts.
-- ====================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1. Campuses table
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campuses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  code        text        NOT NULL CHECK (length(trim(code))  BETWEEN 2 AND 20),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.campuses TO authenticated;

DROP POLICY IF EXISTS "Authenticated users read campuses" ON public.campuses;
CREATE POLICY "Authenticated users read campuses"
  ON public.campuses FOR SELECT
  TO authenticated
  USING (true);

-- ────────────────────────────────────────────────────────────────────
-- 2. Profiles – additive columns
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role               text
    NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'teacher', 'campus_admin', 'super_admin')),
  ADD COLUMN IF NOT EXISTS campus_id          uuid
    REFERENCES public.campuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_activity_date date        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS profiles_campus_idx ON public.profiles (campus_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx   ON public.profiles (role);

-- ────────────────────────────────────────────────────────────────────
-- 3. Update profiles RLS
-- ────────────────────────────────────────────────────────────────────
-- Remove old single-row-only policy from the initial migration so we
-- can replace it with the broader campus-aware policy below.
DROP POLICY IF EXISTS "Students can read their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"         ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"         ON public.profiles;
-- Also drop the new policy names in case this migration is re-applied:
DROP POLICY IF EXISTS "Users read own or campus profiles"    ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile safe"        ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile"             ON public.profiles;

-- 3a. SELECT: own profile, or campus staff reading own campus, or super_admin
CREATE POLICY "Users read own or campus profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles viewer
      WHERE viewer.id = auth.uid()
        AND viewer.role IN ('campus_admin', 'teacher', 'super_admin')
        AND (viewer.role = 'super_admin' OR viewer.campus_id = profiles.campus_id)
    )
  );

-- 3b. INSERT: own profile, only allowed for fresh student accounts
CREATE POLICY "Users insert own profile safe"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND COALESCE(xp, 0)             = 0
    AND COALESCE(level, 1)          = 1
    AND COALESCE(streak, 0)         = 0
    AND COALESCE(role, 'student')   = 'student'
  );

-- 3c. UPDATE: own row only (column-level grants restrict xp/level/streak)
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant editable columns (username and avatar_url already granted; extend to campus_id)
GRANT UPDATE (username, avatar_url, campus_id, last_activity_date, updated_at)
  ON TABLE public.profiles TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 4. Leaderboard RPC
--    get_leaderboard_with_avatars()
--    Called with no arguments from /leaderboard page.
--    SECURITY DEFINER so it bypasses per-row RLS on profiles.
-- ────────────────────────────────────────────────────────────────────

-- 4a. Parameterised version (campus_id filter, configurable limit)
CREATE OR REPLACE FUNCTION public.get_leaderboard_with_avatars(
  p_campus_id uuid    DEFAULT NULL,
  p_limit     integer DEFAULT 100
)
RETURNS TABLE (
  user_id    uuid,
  username   text,
  xp         integer,
  level      integer,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view the leaderboard.';
  END IF;

  RETURN QUERY
    SELECT
      p.id                            AS user_id,
      COALESCE(p.username, 'Learner') AS username,
      COALESCE(p.xp, 0)              AS xp,
      COALESCE(p.level, 1)           AS level,
      p.avatar_url
    FROM public.profiles p
    WHERE
      p.role = 'student'
      AND (p_campus_id IS NULL OR p.campus_id = p_campus_id)
    ORDER BY p.xp DESC NULLS LAST, p.username ASC
    LIMIT LEAST(p_limit, 500);
END;
$$;

REVOKE ALL  ON FUNCTION public.get_leaderboard_with_avatars(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_with_avatars(uuid, integer) TO authenticated;

-- 4b. Zero-argument overload (matches how the /leaderboard page calls it)
CREATE OR REPLACE FUNCTION public.get_leaderboard_with_avatars()
RETURNS TABLE (
  user_id    uuid,
  username   text,
  xp         integer,
  level      integer,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.get_leaderboard_with_avatars(NULL, 100);
$$;

REVOKE ALL  ON FUNCTION public.get_leaderboard_with_avatars() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_with_avatars() TO authenticated;

COMMIT;


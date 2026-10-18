-- Campus clubs and events. Apply after the existing campus/RBAC migrations.
-- Existing authentication, profiles, challenges and quiz tables are untouched.
CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  category text NOT NULL DEFAULT 'Community' CHECK (length(trim(category)) <= 40),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1200),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, name)
);

CREATE TABLE IF NOT EXISTS public.club_members (
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.campus_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1600),
  starts_at timestamptz NOT NULL,
  location text NOT NULL CHECK (length(trim(location)) BETWEEN 2 AND 120),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_registrations (
  event_id uuid NOT NULL REFERENCES public.campus_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS clubs_campus_idx ON public.clubs(campus_id);
CREATE INDEX IF NOT EXISTS events_campus_date_idx ON public.campus_events(campus_id, starts_at);
CREATE INDEX IF NOT EXISTS club_members_user_idx ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS event_registrations_user_idx ON public.event_registrations(user_id);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.clubs TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.club_members TO authenticated;
GRANT SELECT, INSERT ON public.campus_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.event_registrations TO authenticated;

DROP POLICY IF EXISTS "Authenticated users read clubs" ON public.clubs;
CREATE POLICY "Authenticated users read clubs" ON public.clubs
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
      AND (p.role = 'super_admin' OR p.campus_id = clubs.campus_id)
  ));
DROP POLICY IF EXISTS "Campus staff create clubs" ON public.clubs;
CREATE POLICY "Campus staff create clubs" ON public.clubs
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.role = 'super_admin' OR
          (p.role = 'campus_admin' AND p.campus_id = clubs.campus_id))
    )
  );

DROP POLICY IF EXISTS "Users read own or campus memberships" ON public.club_members;
CREATE POLICY "Users read own or campus memberships" ON public.club_members
  FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.clubs c ON c.id = club_members.club_id
      WHERE p.id = (SELECT auth.uid()) AND
        (p.role = 'super_admin' OR (p.role = 'campus_admin' AND p.campus_id = c.campus_id))
    )
  );
DROP POLICY IF EXISTS "Students join campus clubs" ON public.club_members;
CREATE POLICY "Students join campus clubs" ON public.club_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.clubs c ON c.id = club_members.club_id
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'student' AND p.campus_id = c.campus_id
    )
  );
DROP POLICY IF EXISTS "Users leave own clubs" ON public.club_members;
CREATE POLICY "Users leave own clubs" ON public.club_members
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users read campus events" ON public.campus_events;
CREATE POLICY "Authenticated users read campus events" ON public.campus_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
      AND (p.role = 'super_admin' OR p.campus_id = campus_events.campus_id)
  ));
DROP POLICY IF EXISTS "Campus staff create events" ON public.campus_events;
CREATE POLICY "Campus staff create events" ON public.campus_events
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.role = 'super_admin' OR
          (p.role IN ('campus_admin', 'teacher') AND p.campus_id = campus_events.campus_id))
    ) AND (club_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clubs c WHERE c.id = campus_events.club_id AND c.campus_id = campus_events.campus_id
    ))
  );

DROP POLICY IF EXISTS "Users read own or campus event registrations" ON public.event_registrations;
CREATE POLICY "Users read own or campus event registrations" ON public.event_registrations
  FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.campus_events e ON e.id = event_registrations.event_id
      WHERE p.id = (SELECT auth.uid()) AND
        (p.role = 'super_admin' OR (p.role IN ('campus_admin', 'teacher') AND p.campus_id = e.campus_id))
    )
  );
DROP POLICY IF EXISTS "Students register for campus events" ON public.event_registrations;
CREATE POLICY "Students register for campus events" ON public.event_registrations
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.campus_events e ON e.id = event_registrations.event_id
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'student'
        AND p.campus_id = e.campus_id AND e.starts_at > now()
    )
  );
DROP POLICY IF EXISTS "Users cancel own event registration" ON public.event_registrations;
CREATE POLICY "Users cancel own event registration" ON public.event_registrations
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

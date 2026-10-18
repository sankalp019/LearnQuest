-- LearnQuest operations layer: configurable XP, audit trail, and anti-gaming flags.
-- Apply after the existing LearnQuest migrations. Safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS public.xp_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE CHECK (length(trim(action_key)) BETWEEN 2 AND 80),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 120),
  points integer NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 1000),
  daily_limit integer CHECK (daily_limit IS NULL OR daily_limit BETWEEN 1 AND 1000),
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  points integer NOT NULL,
  source_ref text,
  note text NOT NULL DEFAULT '',
  awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type text NOT NULL CHECK (flag_type IN ('xp_spike','quiz_spam','answer_sharing','unverified_practice','other')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','dismissed','actioned')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS xp_ledger_user_created_idx ON public.xp_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS learning_flags_status_created_idx ON public.learning_flags(status, created_at DESC);

ALTER TABLE public.xp_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_flags ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.xp_rules TO authenticated;
GRANT SELECT ON public.xp_ledger TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT SELECT, UPDATE ON public.learning_flags TO authenticated;

DROP POLICY IF EXISTS "Staff read XP rules" ON public.xp_rules;
CREATE POLICY "Staff read XP rules" ON public.xp_rules FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher','campus_admin','super_admin')));
DROP POLICY IF EXISTS "Admins manage XP rules" ON public.xp_rules;
CREATE POLICY "Admins manage XP rules" ON public.xp_rules FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('campus_admin','super_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('campus_admin','super_admin')));

DROP POLICY IF EXISTS "Users read own XP ledger or staff read campus ledger" ON public.xp_ledger;
CREATE POLICY "Users read own XP ledger or staff read campus ledger" ON public.xp_ledger FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.profiles viewer JOIN public.profiles subject ON subject.id = xp_ledger.user_id
  WHERE viewer.id = auth.uid() AND (viewer.role = 'super_admin' OR
    (viewer.role IN ('teacher','campus_admin') AND viewer.campus_id = subject.campus_id))
));

DROP POLICY IF EXISTS "Staff read audit log" ON public.admin_audit_log;
CREATE POLICY "Staff read audit log" ON public.admin_audit_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('campus_admin','super_admin')));
DROP POLICY IF EXISTS "Staff write audit log" ON public.admin_audit_log;
CREATE POLICY "Staff write audit log" ON public.admin_audit_log FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('campus_admin','super_admin','teacher')));

DROP POLICY IF EXISTS "Staff read learning flags" ON public.learning_flags;
CREATE POLICY "Staff read learning flags" ON public.learning_flags FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles viewer JOIN public.profiles subject ON subject.id = learning_flags.user_id
  WHERE viewer.id = auth.uid() AND (viewer.role = 'super_admin' OR
  (viewer.role IN ('teacher','campus_admin') AND viewer.campus_id = subject.campus_id))));
DROP POLICY IF EXISTS "Admins review learning flags" ON public.learning_flags;
CREATE POLICY "Admins review learning flags" ON public.learning_flags FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles viewer JOIN public.profiles subject ON subject.id = learning_flags.user_id
  WHERE viewer.id = auth.uid() AND (viewer.role = 'super_admin' OR
  (viewer.role IN ('teacher','campus_admin') AND viewer.campus_id = subject.campus_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles viewer WHERE viewer.id = auth.uid() AND viewer.role IN ('teacher','campus_admin','super_admin')));

-- Seed editable starter economy; upsert preserves admin-edited values on repeat migration.
INSERT INTO public.xp_rules (action_key,label,points,daily_limit) VALUES
 ('attendance','Attend a class',10,NULL),
 ('assignment','Submit classwork / homework on time',20,NULL),
 ('daily_quiz','Complete daily quiz',15,1),
 ('quiz_correct','Correct daily quiz answer',5,5),
 ('coding_easy','Verified easy coding problem',10,10),
 ('coding_medium','Verified medium coding problem',20,10),
 ('coding_hard','Verified hard coding problem',40,10),
 ('club_activity','Verified club participation',25,1),
 ('seven_day_streak','7-day learning streak bonus',50,NULL),
 ('peer_help','Accepted peer answer',15,3)
ON CONFLICT (action_key) DO NOTHING;

-- Only superadmins may create or edit campus records. Campus admins are campus-scoped elsewhere.
GRANT INSERT, UPDATE, DELETE ON public.campuses TO authenticated;
DROP POLICY IF EXISTS "Super admins manage campuses" ON public.campuses;
CREATE POLICY "Super admins manage campuses" ON public.campuses FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

COMMIT;

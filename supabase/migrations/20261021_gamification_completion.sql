-- LearnQuest gamification completion: privacy preference, quests/badges, streak freezes,
-- auditable XP awards, and ledger reconciliation for quiz attempts.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leaderboard_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_freezes smallint NOT NULL DEFAULT 1 CHECK (streak_freezes BETWEEN 0 AND 3);

CREATE UNIQUE INDEX IF NOT EXISTS xp_ledger_source_idempotency_idx ON public.xp_ledger(user_id, action_key, source_ref) WHERE source_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🏅',
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE IF NOT EXISTS public.quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '',
  quest_type text NOT NULL DEFAULT 'topic' CHECK (quest_type IN ('topic','streak','improvement','team','revision')),
  target_count integer NOT NULL DEFAULT 1 CHECK (target_count BETWEEN 1 AND 1000),
  xp_reward integer NOT NULL DEFAULT 0 CHECK (xp_reward BETWEEN 0 AND 1000),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  campus_id uuid REFERENCES public.campuses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS public.user_quest_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id uuid NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id)
);
CREATE TABLE IF NOT EXISTS public.team_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '',
  campus_id uuid REFERENCES public.campuses(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','completed','cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS public.team_battle_scores (
  battle_id uuid NOT NULL REFERENCES public.team_battles(id) ON DELETE CASCADE,
  team_key text NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  submissions integer NOT NULL DEFAULT 0 CHECK (submissions >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (battle_id, team_key)
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_battle_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges visible to authenticated" ON public.badges;
CREATE POLICY "Badges visible to authenticated" ON public.badges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users read own badge awards" ON public.user_badges;
CREATE POLICY "Users read own badge awards" ON public.user_badges FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher','campus_admin','super_admin')));
DROP POLICY IF EXISTS "Active quests visible to authenticated" ON public.quests;
CREATE POLICY "Active quests visible to authenticated" ON public.quests FOR SELECT TO authenticated USING (active = true OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('campus_admin','super_admin','teacher')));
DROP POLICY IF EXISTS "Users read own quest progress" ON public.user_quest_progress;
CREATE POLICY "Users read own quest progress" ON public.user_quest_progress FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher','campus_admin','super_admin')));
DROP POLICY IF EXISTS "Authenticated read battles" ON public.team_battles;
CREATE POLICY "Authenticated read battles" ON public.team_battles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff manage quests" ON public.quests;
CREATE POLICY "Staff manage quests" ON public.quests FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('teacher','campus_admin','super_admin') AND (p.role='super_admin' OR p.campus_id=quests.campus_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('teacher','campus_admin','super_admin') AND (p.role='super_admin' OR p.campus_id=quests.campus_id)));
DROP POLICY IF EXISTS "Staff manage battles" ON public.team_battles;
CREATE POLICY "Staff manage battles" ON public.team_battles FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('campus_admin','super_admin') AND (p.role='super_admin' OR p.campus_id=team_battles.campus_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('campus_admin','super_admin') AND (p.role='super_admin' OR p.campus_id=team_battles.campus_id)));
DROP POLICY IF EXISTS "Authenticated read battle scores" ON public.team_battle_scores;
CREATE POLICY "Authenticated read battle scores" ON public.team_battle_scores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff manage battle scores" ON public.team_battle_scores;
CREATE POLICY "Staff manage battle scores" ON public.team_battle_scores FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p JOIN public.team_battles b ON b.id=team_battle_scores.battle_id WHERE p.id=auth.uid() AND p.role IN ('campus_admin','super_admin') AND (p.role='super_admin' OR p.campus_id=b.campus_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p JOIN public.team_battles b ON b.id=team_battle_scores.battle_id WHERE p.id=auth.uid() AND p.role IN ('campus_admin','super_admin') AND (p.role='super_admin' OR p.campus_id=b.campus_id)));

GRANT SELECT ON public.badges, public.user_badges, public.quests, public.user_quest_progress, public.team_battles, public.team_battle_scores TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quests, public.team_battles TO authenticated;
GRANT INSERT, UPDATE ON public.team_battle_scores TO authenticated;

-- Starter badges are intentionally criteria-driven and safe to seed repeatedly.
INSERT INTO public.badges (badge_key,name,description,icon,criteria) VALUES
 ('first_quest','First Quest','Complete your first learning challenge.','🌱','{"completed_challenges":1}'),
 ('seven_day_streak','Seven-day streak','Return to learning on seven distinct days.','🔥','{"streak_days":7}'),
 ('comeback','Comeback','Improve your latest quiz score by at least 15 percentage points.','📈','{"improvement_points":15}'),
 ('topic_explorer','Topic explorer','Complete five challenges in one subject.','🧭','{"subject_challenges":5}'),
 ('team_player','Team player','Contribute to a verified team battle.','🤝','{"verified_team_submissions":1}')
ON CONFLICT (badge_key) DO NOTHING;

-- A student can change only their own anonymity setting. The leaderboard RPC below
-- emits a generic display name and no avatar for opted-out students.
CREATE OR REPLACE FUNCTION public.set_leaderboard_anonymous(p_anonymous boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.profiles SET leaderboard_anonymous = p_anonymous, updated_at = now() WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN p_anonymous;
END; $$;
REVOKE ALL ON FUNCTION public.set_leaderboard_anonymous(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_leaderboard_anonymous(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_leaderboard_with_avatars(p_campus_id uuid DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE (user_id uuid, username text, xp integer, level integer, avatar_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required to view the leaderboard.'; END IF;
  RETURN QUERY SELECT
    CASE WHEN p.leaderboard_anonymous THEN md5(p.id::text)::uuid ELSE p.id END,
    CASE WHEN p.leaderboard_anonymous THEN 'Anonymous learner' ELSE COALESCE(p.username, 'Learner') END,
    COALESCE(p.xp,0)::integer,
    COALESCE(p.level,1)::integer,
    CASE WHEN p.leaderboard_anonymous THEN NULL ELSE p.avatar_url END
  FROM public.profiles p
  WHERE p.role = 'student' AND (p_campus_id IS NULL OR p.campus_id = p_campus_id)
  ORDER BY p.xp DESC NULLS LAST, p.username ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),500);
END; $$;
CREATE OR REPLACE FUNCTION public.get_leaderboard_with_avatars()
RETURNS TABLE (user_id uuid, username text, xp integer, level integer, avatar_url text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT * FROM public.get_leaderboard_with_avatars(NULL,100);
$$;
REVOKE ALL ON FUNCTION public.get_leaderboard_with_avatars(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_leaderboard_with_avatars() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_with_avatars(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_with_avatars() TO authenticated;

-- Streaks count distinct learning days, not quiz attempts. A limited freeze can
-- preserve a streak over a short absence; crossing day seven grants one audited bonus.
CREATE OR REPLACE FUNCTION public.enforce_learning_streak()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_gap integer; v_freezes integer; v_old_streak integer;
BEGIN
  IF NEW.xp IS DISTINCT FROM OLD.xp AND NEW.xp > COALESCE(OLD.xp,0) THEN
    v_old_streak := COALESCE(OLD.streak,0);
    IF OLD.last_activity_date IS NULL THEN
      NEW.streak := 1;
    ELSIF OLD.last_activity_date = current_date THEN
      NEW.streak := v_old_streak;
    ELSE
      v_gap := current_date - OLD.last_activity_date;
      IF v_gap = 1 THEN
        NEW.streak := v_old_streak + 1;
      ELSE
        v_freezes := COALESCE(OLD.streak_freezes,0);
        IF v_gap > 1 AND v_freezes >= v_gap - 1 THEN
          NEW.streak := v_old_streak + 1;
          NEW.streak_freezes := v_freezes - (v_gap - 1);
        ELSE
          NEW.streak := 1;
        END IF;
      END IF;
    END IF;
    NEW.last_activity_date := current_date;
    IF NEW.streak = 7 AND v_old_streak < 7 THEN
      INSERT INTO public.xp_ledger(user_id,action_key,points,source_ref,note,awarded_by)
      VALUES(NEW.id,'seven_day_streak',50,'streak-bonus:' || current_date::text,'Seven distinct learning days reached',NULL)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN NEW.xp := COALESCE(NEW.xp,0) + 50; END IF;
    END IF;
    NEW.level := 1 + floor(COALESCE(NEW.xp,0)::numeric / 100)::integer;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS profiles_learning_streak ON public.profiles;
DROP TRIGGER IF EXISTS profiles_learning_streak_insert ON public.profiles;
CREATE TRIGGER profiles_learning_streak BEFORE UPDATE OF xp ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_learning_streak();
CREATE TRIGGER profiles_learning_streak_insert BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_learning_streak();

-- Trusted staff can award externally verified learning actions. Idempotency is keyed
-- by action + source reference; per-rule daily limits are checked transactionally.
CREATE OR REPLACE FUNCTION public.award_verified_xp(
  p_user_id uuid, p_action_key text, p_source_ref text, p_note text DEFAULT '', p_points_override integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid := auth.uid(); v_role text; v_rule public.xp_rules%ROWTYPE; v_points integer; v_count integer; v_ledger_id uuid; v_total integer; v_level integer;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_actor;
  IF v_role IS NULL OR v_role NOT IN ('teacher','campus_admin','super_admin') THEN RAISE EXCEPTION 'Staff access required'; END IF;
  IF p_user_id IS NULL OR length(trim(COALESCE(p_source_ref,''))) < 1 THEN RAISE EXCEPTION 'Student and verifiable source reference are required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_action_key || ':' || current_date::text, 0));
  SELECT * INTO v_rule FROM public.xp_rules WHERE action_key = p_action_key AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'XP action is not enabled'; END IF;
  v_points := COALESCE(p_points_override,v_rule.points);
  IF v_points < 0 OR v_points > 1000 THEN RAISE EXCEPTION 'Invalid XP amount'; END IF;
  IF v_role <> 'super_admin' AND v_role IN ('teacher','campus_admin') AND NOT EXISTS (
    SELECT 1 FROM public.profiles actor JOIN public.profiles target ON target.id=p_user_id
    WHERE actor.id=v_actor AND (actor.role='super_admin' OR actor.campus_id=target.campus_id)
  ) THEN RAISE EXCEPTION 'Student is outside your campus'; END IF;
  IF EXISTS (SELECT 1 FROM public.xp_ledger WHERE user_id=p_user_id AND action_key=p_action_key AND source_ref=p_source_ref) THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true);
  END IF;
  IF v_rule.daily_limit IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.xp_ledger WHERE user_id=p_user_id AND action_key=p_action_key AND created_at >= date_trunc('day',now());
    IF v_count >= v_rule.daily_limit THEN RAISE EXCEPTION 'Daily XP limit reached for this action'; END IF;
  END IF;
  INSERT INTO public.xp_ledger(user_id,action_key,points,source_ref,note,awarded_by)
  VALUES(p_user_id,p_action_key,v_points,p_source_ref,left(COALESCE(p_note,''),500),v_actor) RETURNING id INTO v_ledger_id;
  UPDATE public.profiles SET xp=COALESCE(xp,0)+v_points, level=1+floor((COALESCE(xp,0)+v_points)::numeric/100)::integer, updated_at=now() WHERE id=p_user_id RETURNING xp,level INTO v_total,v_level;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student profile not found'; END IF;
  INSERT INTO public.admin_audit_log(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_actor,'xp.awarded','profile',p_user_id::text,left(COALESCE(p_note,''),500),jsonb_build_object('action_key',p_action_key,'points',v_points,'source_ref',p_source_ref));
  RETURN jsonb_build_object('ok',true,'duplicate',false,'ledger_id',v_ledger_id,'points',v_points,'total_xp',v_total,'level',v_level);
END; $$;
REVOKE ALL ON FUNCTION public.award_verified_xp(uuid,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_verified_xp(uuid,text,text,text,integer) TO authenticated;

-- Keep existing quiz XP in the ledger without changing the established submit_quiz RPC.
CREATE OR REPLACE FUNCTION public.record_quiz_xp_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.xp_ledger(user_id,action_key,points,source_ref,note,awarded_by)
  VALUES(NEW.user_id,'quiz_attempt',COALESCE(NEW.xp_earned,0),NEW.id::text,'XP earned from quiz attempt',NULL)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS challenge_attempt_xp_ledger ON public.challenge_attempts;
CREATE TRIGGER challenge_attempt_xp_ledger AFTER INSERT ON public.challenge_attempts FOR EACH ROW EXECUTE FUNCTION public.record_quiz_xp_ledger();

COMMIT;

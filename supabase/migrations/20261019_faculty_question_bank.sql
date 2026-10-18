-- Faculty question-bank authoring and campus-scoped analytics.
BEGIN;

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Staff read campus quiz attempts" ON public.challenge_attempts;
CREATE POLICY "Staff read campus quiz attempts" ON public.challenge_attempts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles viewer
    JOIN public.profiles learner ON learner.id = challenge_attempts.user_id
    WHERE viewer.id = auth.uid()
      AND (viewer.role = 'super_admin' OR
        (viewer.role IN ('teacher','campus_admin') AND viewer.campus_id = learner.campus_id))
  )
);

DROP POLICY IF EXISTS "Staff read managed challenges" ON public.challenges;
CREATE POLICY "Staff read managed challenges" ON public.challenges FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles viewer WHERE viewer.id = auth.uid() AND
  (viewer.role = 'super_admin' OR (viewer.role IN ('teacher','campus_admin') AND
  (challenges.campus_id IS NULL OR challenges.campus_id = viewer.campus_id)))));

DROP POLICY IF EXISTS "Staff read managed question bank" ON public.questions;
CREATE POLICY "Staff read managed question bank" ON public.questions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.challenges c JOIN public.profiles viewer ON viewer.id = auth.uid()
  WHERE c.id = questions.challenge_id AND viewer.role IN ('teacher','campus_admin','super_admin') AND
  (viewer.role = 'super_admin' OR c.campus_id IS NULL OR c.campus_id = viewer.campus_id)));

CREATE OR REPLACE FUNCTION public.faculty_create_challenge(
  p_title text,
  p_description text,
  p_subject text,
  p_difficulty text,
  p_xp_reward integer,
  p_is_published boolean,
  p_questions jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_campus_id uuid;
  v_challenge_id uuid;
  v_item jsonb;
  v_question_id uuid;
  v_position integer := 0;
  v_options jsonb;
  v_correct text;
  v_count integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT role, campus_id INTO v_role, v_campus_id FROM public.profiles WHERE id = v_user;
  IF COALESCE(v_role,'') NOT IN ('teacher','campus_admin','super_admin') THEN RAISE EXCEPTION 'Faculty or admin access required'; END IF;
  IF length(trim(COALESCE(p_title,''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Title must be 3–120 characters'; END IF;
  IF length(trim(COALESCE(p_subject,''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Subject must be 2–80 characters'; END IF;
  IF p_difficulty IS NULL OR p_difficulty NOT IN ('Easy','Medium','Hard','beginner','intermediate','advanced') THEN RAISE EXCEPTION 'Invalid difficulty'; END IF;
  IF p_xp_reward IS NULL OR p_xp_reward < 0 OR p_xp_reward > 500 THEN RAISE EXCEPTION 'XP reward must be between 0 and 500'; END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN RAISE EXCEPTION 'Questions must be a JSON array'; END IF;
  IF jsonb_array_length(p_questions) NOT BETWEEN 3 AND 20 THEN RAISE EXCEPTION 'Provide between 3 and 20 questions'; END IF;

  INSERT INTO public.challenges(title,description,subject,difficulty,xp_reward,is_published,created_at,created_by,campus_id)
  VALUES (trim(p_title),left(trim(COALESCE(p_description,'')),2000),trim(p_subject),p_difficulty,p_xp_reward,COALESCE(p_is_published,false),now(),v_user,v_campus_id)
  RETURNING id INTO v_challenge_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_questions)
  LOOP
    v_position := v_position + 1;
    IF length(trim(COALESCE(v_item->>'question_text',''))) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Question % must be 5–1000 characters',v_position; END IF;
    v_options := v_item->'options';
    IF jsonb_typeof(v_options) <> 'array' OR jsonb_array_length(v_options) <> 4 THEN RAISE EXCEPTION 'Question % must have exactly four options',v_position; END IF;
    v_correct := trim(COALESCE(v_item->>'correct_answer',''));
    IF v_correct = '' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_options) opt WHERE trim(opt) = v_correct) THEN RAISE EXCEPTION 'Correct answer for question % must match one of its options',v_position; END IF;
    IF (SELECT count(DISTINCT trim(opt)) FROM jsonb_array_elements_text(v_options) opt) <> 4 THEN RAISE EXCEPTION 'Question % must have four distinct options',v_position; END IF;

    INSERT INTO public.questions(challenge_id,question_text,options,position,points,created_at)
    VALUES(v_challenge_id,trim(v_item->>'question_text'),v_options,v_position,LEAST(100,GREATEST(1,COALESCE((v_item->>'points')::integer,10))),now())
    RETURNING id INTO v_question_id;

    INSERT INTO public.quiz_answer_keys(question_id,correct_answer,explanation)
    VALUES(v_question_id,v_correct,left(COALESCE(v_item->>'explanation',''),2000));
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'challenge.created','challenge',v_challenge_id::text,'Created from question bank',jsonb_build_object('title',p_title,'subject',p_subject,'question_count',v_count,'published',p_is_published));

  RETURN jsonb_build_object('ok',true,'challenge_id',v_challenge_id,'question_count',v_count,'is_published',p_is_published);
END;
$$;
REVOKE ALL ON FUNCTION public.faculty_create_challenge(text,text,text,text,integer,boolean,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.faculty_create_challenge(text,text,text,text,integer,boolean,jsonb) TO authenticated;
COMMIT;

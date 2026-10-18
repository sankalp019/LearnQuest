-- ====================================================================
-- LearnQuest: Hardened Challenge & Quiz System Migration
-- Date: 2026-10-13
--
-- Security & Schema Alignment:
-- - Uses existing `challenge_attempts` table (0 rows).
-- - Adds `submitted_answers JSONB DEFAULT '{}'::jsonb`.
-- - Ensures column defaults on `challenge_attempts` (id, completed_at).
-- - Non-destructively enforces unique constraint on (user_id, challenge_id).
-- - Restricts `profiles` reads strictly to authenticated user's own profile (no anon/public exposure).
-- - Explicitly drops all existing "Students can..." policies to prevent permissive policy accumulation.
-- - Completely isolates `quiz_answer_keys` from client roles (RLS enabled, zero policies, zero client grants).
-- - Server-side grading via `submit_quiz` (SECURITY DEFINER, owned by postgres).
-- - Validates that every question has a configured answer key before grading begins.
-- - Blocks direct client tampering of xp, level, streak via column-level revocation and trigger check.
-- - Consistent duplicate submission response returning current `newTotalXp` and `newLevel` even if profile row is missing.
-- - Fully transactional (BEGIN / COMMIT) with zero silent error suppression.
-- ====================================================================

BEGIN;

-- 1. Create private answer key storage (isolated from public questions table)
CREATE TABLE IF NOT EXISTS public.quiz_answer_keys (
  question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  correct_answer TEXT NOT NULL
);

-- 2. Ensure existing `challenge_attempts` table supports quiz runner tracking
ALTER TABLE public.challenge_attempts
  ADD COLUMN IF NOT EXISTS submitted_answers JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.challenge_attempts
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN completed_at SET DEFAULT now();

-- Non-destructively check and enforce unique constraint on (user_id, challenge_id)
DO $$
DECLARE
  v_constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.challenge_attempts'::regclass
      AND c.contype IN ('u', 'p')
      AND ARRAY(
        SELECT a.attname::text
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ORDER BY k.ord
      ) = ARRAY['user_id', 'challenge_id']::text[]
  ) INTO v_constraint_exists;

  IF NOT v_constraint_exists THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'public.challenge_attempts'::regclass
        AND c.contype IN ('u', 'p')
        AND ARRAY(
          SELECT a.attname::text
          FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          ORDER BY k.ord
        ) = ARRAY['challenge_id', 'user_id']::text[]
    ) INTO v_constraint_exists;
  END IF;

  IF NOT v_constraint_exists THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'challenge_attempts_user_challenge_unique'
        AND conrelid = 'public.challenge_attempts'::regclass
    ) INTO v_constraint_exists;
  END IF;

  IF NOT v_constraint_exists THEN
    ALTER TABLE public.challenge_attempts
      ADD CONSTRAINT challenge_attempts_user_challenge_unique UNIQUE (user_id, challenge_id);
    RAISE NOTICE 'Added unique constraint challenge_attempts_user_challenge_unique on (user_id, challenge_id).';
  ELSE
    RAISE NOTICE 'Unique constraint on (user_id, challenge_id) already exists.';
  END IF;
END $$;

-- Ensure safe progression column defaults on public.profiles
ALTER TABLE public.profiles
  ALTER COLUMN xp SET DEFAULT 0,
  ALTER COLUMN level SET DEFAULT 1,
  ALTER COLUMN streak SET DEFAULT 0;

-- 3. Enable Row Level Security (RLS) on all participating tables
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answer_keys ENABLE ROW LEVEL SECURITY;

-- 4. Restrict direct client permissions (prevent unauthorized DML & answer harvesting)
REVOKE ALL ON public.quiz_answer_keys FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.challenge_attempts FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.challenges FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.questions FROM anon, authenticated, PUBLIC;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM anon, PUBLIC;

-- Table-level grants for legitimate operations
GRANT SELECT ON public.challenges TO anon, authenticated;
GRANT SELECT ON public.questions TO anon, authenticated;
GRANT SELECT ON public.challenge_attempts TO authenticated;
GRANT SELECT, INSERT ON public.profiles TO authenticated;

-- Database-enforced column privileges on profiles:
-- 4a. Revoke table-level UPDATE from client roles
REVOKE UPDATE ON TABLE public.profiles FROM anon, authenticated, PUBLIC;

-- 4b. Explicitly revoke preexisting column-level UPDATE grants on sensitive progression columns
REVOKE UPDATE (xp, level, streak) ON TABLE public.profiles FROM anon, authenticated, PUBLIC;

-- 4c. Grant column-level UPDATE strictly on user-editable profile attributes
GRANT UPDATE (username, updated_at) ON TABLE public.profiles TO authenticated;


-- 5. Targeted Policy Management (Drops all known existing & transitional policy names)

-- 5a. Challenges: Read-only for published challenges
DROP POLICY IF EXISTS "Enable all access" ON public.challenges;
DROP POLICY IF EXISTS "Students can read published challenges" ON public.challenges;
DROP POLICY IF EXISTS "Published challenges are viewable by all" ON public.challenges;

CREATE POLICY "Students can read published challenges"
  ON public.challenges FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- 5b. Questions: Read-only STRICTLY for questions belonging to published challenges
DROP POLICY IF EXISTS "Enable all access" ON public.questions;
DROP POLICY IF EXISTS "Questions are viewable by all" ON public.questions;
DROP POLICY IF EXISTS "Questions are viewable for published challenges" ON public.questions;
DROP POLICY IF EXISTS "Students can read questions from published challenges" ON public.questions;

CREATE POLICY "Students can read questions from published challenges"
  ON public.questions FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenges c
      WHERE c.id = public.questions.challenge_id
        AND c.is_published = true
    )
  );

-- 5c. Challenge Attempts: Students can ONLY select their own attempt history.
-- Explicitly drops any INSERT policies so students cannot inject fake attempts.
DROP POLICY IF EXISTS "Enable all access" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Students can create their own attempts" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Students can read their own attempts" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Users can update own attempts" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Users can delete own attempts" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Users can view own attempts" ON public.challenge_attempts;

CREATE POLICY "Students can read their own attempts"
  ON public.challenge_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5d. Quiz Answer Keys: Explicitly kept WITHOUT any policies
-- Table has RLS enabled and REVOKE ALL from anon, authenticated, PUBLIC.
-- Only SECURITY DEFINER functions owned by postgres can access it.
DROP POLICY IF EXISTS "Enable all access" ON public.quiz_answer_keys;
DROP POLICY IF EXISTS "Public answer keys" ON public.quiz_answer_keys;
DROP POLICY IF EXISTS "Users can view answer keys" ON public.quiz_answer_keys;

-- 5e. Profiles: Own-profile reads only, safe registration check, non-recursive self-update
DROP POLICY IF EXISTS "Enable all access" ON public.profiles;
DROP POLICY IF EXISTS "Students can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own progression" ON public.profiles;

CREATE POLICY "Students can read their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND COALESCE(xp, 0) = 0
    AND COALESCE(level, 1) = 1
    AND COALESCE(streak, 0) = 0
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- 6. Secondary Defense-in-Depth Trigger: Progression Protection
-- Runs as SECURITY INVOKER to verify execution role. Even if table-level UPDATE privileges
-- were altered, direct client roles ('authenticated', 'anon', 'public') are blocked
-- from changing xp, level, or streak.
CREATE OR REPLACE FUNCTION public.protect_profile_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.xp IS DISTINCT FROM OLD.xp OR NEW.level IS DISTINCT FROM OLD.level OR NEW.streak IS DISTINCT FROM OLD.streak) THEN
    IF current_user IN ('authenticated', 'anon', 'public') THEN
      RAISE EXCEPTION 'Direct modification of profile progression (xp/level/streak) is prohibited.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_progression ON public.profiles;
CREATE TRIGGER tr_protect_profile_progression
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_progression();


-- 7. Atomic, Tamper-Proof Quiz Submission Function
CREATE OR REPLACE FUNCTION public.submit_quiz(
  p_challenge_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_default_username TEXT;
  v_existing_attempt public.challenge_attempts%ROWTYPE;
  v_challenge public.challenges%ROWTYPE;
  v_q RECORD;
  v_selected TEXT;
  v_correct TEXT;
  v_is_correct BOOLEAN;
  v_is_valid_option BOOLEAN;
  v_score INTEGER := 0;
  v_total_points INTEGER := 0;
  v_correct_count INTEGER := 0;
  v_total_questions INTEGER := 0;
  v_xp_earned INTEGER := 0;
  v_results JSONB := '[]'::jsonb;
  v_cleaned_answers JSONB := '{}'::jsonb;
  v_final_xp INTEGER := 0;
  v_final_level INTEGER := 1;
BEGIN
  -- A. Authentication validation
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit quiz';
  END IF;

  -- B. Parameter validation
  IF p_challenge_id IS NULL THEN
    RAISE EXCEPTION 'Challenge ID cannot be null';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Invalid answers format: expected JSON object';
  END IF;

  -- C. Transaction advisory lock: serializes concurrent submissions for this user & challenge
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text || p_challenge_id::text));

  -- D. Fetch challenge details (must be published)
  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE id = p_challenge_id AND is_published = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found or not published';
  END IF;

  -- Verify questions exist and every question has an answer key configured
  SELECT count(*) INTO v_total_questions
  FROM public.questions
  WHERE challenge_id = p_challenge_id;

  IF v_total_questions = 0 THEN
    RAISE EXCEPTION 'No questions found for this challenge';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.questions q
    LEFT JOIN public.quiz_answer_keys ak ON ak.question_id = q.id
    WHERE q.challenge_id = p_challenge_id
      AND (ak.correct_answer IS NULL OR TRIM(ak.correct_answer) = '')
  ) THEN
    RAISE EXCEPTION 'Quiz configuration error: one or more questions are missing answer keys';
  END IF;

  -- Reset question counter for sequential processing
  v_total_questions := 0;

  -- E. Duplicate Check
  SELECT * INTO v_existing_attempt
  FROM public.challenge_attempts
  WHERE user_id = v_user_id AND challenge_id = p_challenge_id;

  IF FOUND THEN
    -- Challenge already completed: reconstruct review strictly from RECORDED submitted answers
    FOR v_q IN
      SELECT q.id, q.question_text, q.points, ak.correct_answer
      FROM public.questions q
      JOIN public.quiz_answer_keys ak ON ak.question_id = q.id
      WHERE q.challenge_id = p_challenge_id
      ORDER BY q.position ASC
    LOOP
      v_total_questions := v_total_questions + 1;
      v_total_points := v_total_points + COALESCE(v_q.points, 10);
      v_selected := COALESCE(v_existing_attempt.submitted_answers ->> v_q.id::text, '');
      v_correct := COALESCE(v_q.correct_answer, '');

      -- Grading comparison exactly identical to first-submission grading
      v_is_correct := (
        v_selected <> '' AND v_correct <> '' AND (
          LOWER(TRIM(v_selected)) = LOWER(TRIM(v_correct))
          OR (v_selected LIKE '[%]' AND v_correct LIKE '[%]' AND TRIM(v_selected) = TRIM(v_correct))
        )
      );

      IF v_is_correct THEN
        v_correct_count := v_correct_count + 1;
      END IF;

      v_results := v_results || jsonb_build_object(
        'questionId', v_q.id,
        'questionText', v_q.question_text,
        'selectedAnswer', v_selected,
        'correctAnswer', v_correct,
        'isCorrect', v_is_correct,
        'points', COALESCE(v_q.points, 10)
      );
    END LOOP;

    -- Retrieve current profile total XP and level for consistent UI display (safeguarded against missing profile row)
    v_final_xp := 0;
    v_final_level := 1;

    SELECT COALESCE(xp, 0), COALESCE(level, 1)
    INTO v_final_xp, v_final_level
    FROM public.profiles
    WHERE id = v_user_id;

    v_final_xp := COALESCE(v_final_xp, 0);
    v_final_level := COALESCE(v_final_level, 1);

    RETURN jsonb_build_object(
      'ok', true,
      'alreadyCompleted', true,
      'challengeId', p_challenge_id,
      'totalQuestions', COALESCE(v_existing_attempt.total_questions, v_total_questions),
      'correctCount', v_correct_count,
      'score', v_existing_attempt.score,
      'totalPoints', v_total_points,
      'xpEarned', 0,
      'message', 'Challenge previously completed. No duplicate XP awarded.',
      'results', v_results,
      'newTotalXp', v_final_xp,
      'newLevel', v_final_level
    );
  END IF;

  -- F. First-time grading:
  -- Filter submitted answers to only legitimate question IDs belonging to this challenge
  -- and defensively validate that each answer matches a permitted option.
  FOR v_q IN
    SELECT q.id, q.question_text, q.options, q.points, ak.correct_answer
    FROM public.questions q
    JOIN public.quiz_answer_keys ak ON ak.question_id = q.id
    WHERE q.challenge_id = p_challenge_id
    ORDER BY q.position ASC
  LOOP
    v_total_questions := v_total_questions + 1;
    v_total_points := v_total_points + COALESCE(v_q.points, 10);
    v_selected := TRIM(COALESCE(p_answers ->> v_q.id::text, ''));

    -- Explicitly validate that submitted answer is one of the permitted options
    v_is_valid_option := false;
    IF v_q.options IS NOT NULL THEN
      IF jsonb_typeof(v_q.options) = 'array' THEN
        SELECT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_q.options) opt
          WHERE TRIM(opt #>> '{}') = v_selected
             OR TRIM(opt ->> 'text') = v_selected
             OR TRIM(opt ->> 'value') = v_selected
             OR TRIM(opt ->> 'label') = v_selected
        ) INTO v_is_valid_option;
      ELSIF jsonb_typeof(v_q.options) = 'object' THEN
        SELECT EXISTS (
          SELECT 1
          FROM jsonb_each_text(v_q.options) kv
          WHERE TRIM(kv.value) = v_selected OR TRIM(kv.key) = v_selected
        ) INTO v_is_valid_option;
      END IF;
    END IF;

    IF NOT v_is_valid_option THEN
      v_selected := '';
    ELSE
      v_cleaned_answers := v_cleaned_answers || jsonb_build_object(v_q.id::text, v_selected);
    END IF;

    v_correct := COALESCE(v_q.correct_answer, '');
    v_is_correct := (
      v_selected <> '' AND v_correct <> '' AND (
        LOWER(TRIM(v_selected)) = LOWER(TRIM(v_correct))
        OR (v_selected LIKE '[%]' AND v_correct LIKE '[%]' AND TRIM(v_selected) = TRIM(v_correct))
      )
    );

    IF v_is_correct THEN
      v_correct_count := v_correct_count + 1;
      v_score := v_score + COALESCE(v_q.points, 10);
    END IF;

    v_results := v_results || jsonb_build_object(
      'questionId', v_q.id,
      'questionText', v_q.question_text,
      'selectedAnswer', v_selected,
      'correctAnswer', v_correct,
      'isCorrect', v_is_correct,
      'points', COALESCE(v_q.points, 10)
    );
  END LOOP;

  -- G. Calculate proportional XP reward
  IF v_total_points > 0 THEN
    v_xp_earned := ROUND((v_score::numeric / v_total_points::numeric) * COALESCE(v_challenge.xp_reward, 50));
  ELSE
    v_xp_earned := 0;
  END IF;

  -- H. Atomic attempt insert into challenge_attempts
  INSERT INTO public.challenge_attempts (
    user_id,
    challenge_id,
    score,
    total_questions,
    xp_earned,
    submitted_answers,
    completed_at
  )
  VALUES (
    v_user_id,
    p_challenge_id,
    v_score,
    v_total_questions,
    v_xp_earned,
    v_cleaned_answers,
    now()
  );

  -- I. Atomic profile XP and Level update
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  v_default_username := NULLIF(TRIM(SPLIT_PART(v_user_email, '@', 1)), '');
  IF v_default_username IS NULL THEN
    v_default_username := 'Learner';
  END IF;

  INSERT INTO public.profiles (id, username, xp, level, streak)
  VALUES (v_user_id, v_default_username, v_xp_earned, FLOOR(v_xp_earned / 100) + 1, 1)
  ON CONFLICT (id) DO UPDATE
  SET xp = COALESCE(public.profiles.xp, 0) + v_xp_earned,
      level = FLOOR((COALESCE(public.profiles.xp, 0) + v_xp_earned) / 100) + 1,
      updated_at = now();

  SELECT COALESCE(xp, 0), COALESCE(level, 1)
  INTO v_final_xp, v_final_level
  FROM public.profiles
  WHERE id = v_user_id;

  v_final_xp := COALESCE(v_final_xp, 0);
  v_final_level := COALESCE(v_final_level, 1);

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyCompleted', false,
    'challengeId', p_challenge_id,
    'totalQuestions', v_total_questions,
    'correctCount', v_correct_count,
    'score', v_score,
    'totalPoints', v_total_points,
    'xpEarned', v_xp_earned,
    'results', v_results,
    'newTotalXp', v_final_xp,
    'newLevel', v_final_level
  );
END;
$$;

-- 8. Function Ownership and Execution Privileges
ALTER FUNCTION public.submit_quiz(UUID, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.submit_quiz(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz(UUID, JSONB) TO authenticated;

-- 9. Seed Curated Challenges (Idempotent: RFC-4122 v4 UUIDs)
INSERT INTO public.challenges (id, title, description, subject, difficulty, xp_reward, is_published, created_at)
VALUES
  (
    'c1111111-1111-4111-8111-111111111111',
    'Array & String Fundamentals',
    'Master core operations, index lookups, memory contiguousness, and in-place manipulations.',
    'Data Structures',
    'Easy',
    50,
    true,
    now()
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'Two Pointers & Sliding Window',
    'Learn how to solve subarray and sorted sequence problems in linear O(N) time complexity.',
    'Algorithms',
    'Medium',
    75,
    true,
    now()
  ),
  (
    'c3333333-3333-4333-8333-333333333333',
    'Asynchronous JavaScript & Promises',
    'Deep dive into the microtask queue, Promise lifecycle, async/await, and error handling.',
    'Web Core',
    'Easy',
    50,
    true,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- 10. Seed Questions (JSONB options, RFC-4122 v4 UUIDs)
INSERT INTO public.questions (id, challenge_id, question_text, options, position, points, created_at)
VALUES
  -- Challenge 1
  (
    'a1111111-1111-4111-8111-111111111101',
    'c1111111-1111-4111-8111-111111111111',
    'What is the worst-case time complexity of accessing an element by index in a contiguous array?',
    '["O(1)", "O(n)", "O(log n)", "O(n²)"]'::jsonb,
    1,
    10,
    now()
  ),
  (
    'a1111111-1111-4111-8111-111111111102',
    'c1111111-1111-4111-8111-111111111111',
    'In JavaScript, what does ["a", "b", "c", "d"].slice(1, 3) return?',
    '["[\"b\", \"c\"]", "[\"a\", \"b\"]", "[\"b\", \"c\", \"d\"]", "[\"c\", \"d\"]"]'::jsonb,
    2,
    10,
    now()
  ),
  (
    'a1111111-1111-4111-8111-111111111103',
    'c1111111-1111-4111-8111-111111111111',
    'Why are dynamic arrays able to achieve amortized O(1) push operations?',
    '["They double capacity when full, spreading out reallocation cost", "They store elements in non-contiguous linked memory nodes", "They use a binary heap to balance inserts", "They compress existing elements using bitwise operations"]'::jsonb,
    3,
    10,
    now()
  ),

  -- Challenge 2
  (
    'a2222222-2222-4222-8222-222222222201',
    'c2222222-2222-4222-8222-222222222222',
    'In the Two Pointers pattern for a sorted array pair sum, what should you do if current sum < target?',
    '["Increment the left pointer", "Decrement the right pointer", "Reset both pointers to zero", "Swap the elements at both pointers"]'::jsonb,
    1,
    15,
    now()
  ),
  (
    'a2222222-2222-4222-8222-222222222202',
    'c2222222-2222-4222-8222-222222222222',
    'What is the typical time complexity of the Sliding Window technique compared to a nested loop brute-force?',
    '["O(n) vs O(n²)", "O(log n) vs O(n)", "O(1) vs O(n)", "O(n log n) vs O(n²)"]'::jsonb,
    2,
    15,
    now()
  ),
  (
    'a2222222-2222-4222-8222-222222222203',
    'c2222222-2222-4222-8222-222222222222',
    'Which data structure is optimal to maintain frequency counts in dynamic sliding window problems?',
    '["Hash Map (or frequency array)", "Binary Search Tree", "Linked List", "Stack"]'::jsonb,
    3,
    15,
    now()
  ),

  -- Challenge 3
  (
    'a3333333-3333-4333-8333-333333333301',
    'c3333333-3333-4333-8333-333333333333',
    'What is the initial state of a newly created Promise instance before resolution or rejection?',
    '["pending", "fulfilled", "rejected", "settled"]'::jsonb,
    1,
    10,
    now()
  ),
  (
    'a3333333-3333-4333-8333-333333333302',
    'c3333333-3333-4333-8333-333333333333',
    'Where are Promise .then() callbacks queued in the JavaScript Event Loop?',
    '["Microtask queue", "Macrotask queue (Task queue)", "Call stack directly", "Worker thread pool"]'::jsonb,
    2,
    10,
    now()
  ),
  (
    'a3333333-3333-4333-8333-333333333303',
    'c3333333-3333-4333-8333-333333333333',
    'Which combinator rejects immediately if ANY of the input promises rejects?',
    '["Promise.all()", "Promise.allSettled()", "Promise.any()", "Promise.race()"]'::jsonb,
    3,
    10,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- 11. Seed Answer Keys into protected quiz_answer_keys table
INSERT INTO public.quiz_answer_keys (question_id, correct_answer)
VALUES
  ('a1111111-1111-4111-8111-111111111101', 'O(1)'),
  ('a1111111-1111-4111-8111-111111111102', '["b", "c"]'),
  ('a1111111-1111-4111-8111-111111111103', 'They double capacity when full, spreading out reallocation cost'),
  ('a2222222-2222-4222-8222-222222222201', 'Increment the left pointer'),
  ('a2222222-2222-4222-8222-222222222202', 'O(n) vs O(n²)'),
  ('a2222222-2222-4222-8222-222222222203', 'Hash Map (or frequency array)'),
  ('a3333333-3333-4333-8333-333333333301', 'pending'),
  ('a3333333-3333-4333-8333-333333333302', 'Microtask queue'),
  ('a3333333-3333-4333-8333-333333333303', 'Promise.all()')
ON CONFLICT (question_id) DO NOTHING;

COMMIT;

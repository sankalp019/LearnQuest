-- ====================================================================
-- LearnQuest: Additive Migration - Quiz Option Reordering, Explanations & Snapshots
-- Date: 2026-10-13
--
-- Safeguards & Features:
-- 1. Adds `explanation` column to private `quiz_answer_keys` table.
-- 2. Adds `options_snapshot` column to `challenge_attempts` table.
-- 3. Non-destructively backfills `options_snapshot` on any existing attempts
--    using the original question options order BEFORE options are updated.
-- 4. Reorders options across all 3 challenges to enforce non-consecutive
--    answer distributions:
--      Challenge 1: C -> A -> D
--      Challenge 2: B -> D -> A
--      Challenge 3: D -> B -> C
-- 5. Populates question-specific educational explanations in `quiz_answer_keys`.
-- 6. Adds dedicated read-only `get_quiz_review` RPC and updates `submit_quiz`
--    to support options snapshots and return explanations.
-- 7. 100% data-preserving: retains all user progress, XP, streaks, levels, and attempts.
-- ====================================================================

BEGIN;

-- 1. Additive columns
ALTER TABLE public.quiz_answer_keys
  ADD COLUMN IF NOT EXISTS explanation TEXT;

ALTER TABLE public.challenge_attempts
  ADD COLUMN IF NOT EXISTS options_snapshot JSONB DEFAULT NULL;

-- 2. Preserve historical attempts:
-- Backfill options_snapshot for any existing attempts using current question options
-- BEFORE public.questions options are reordered!
UPDATE public.challenge_attempts ca
SET options_snapshot = (
  SELECT jsonb_object_agg(q.id::text, q.options)
  FROM public.questions q
  WHERE q.challenge_id = ca.challenge_id
)
WHERE ca.options_snapshot IS NULL;

-- 3. Targeted Updates: Reorder Question Options
-- Challenge 1: Array & String Fundamentals
-- Target distribution: C -> A -> D

-- Q1 (Target: C) - Correct answer: 'O(1)' at index 2
UPDATE public.questions
SET options = '["O(n)", "O(log n)", "O(1)", "O(n²)"]'::jsonb
WHERE id = 'a1111111-1111-4111-8111-111111111101';

-- Q2 (Target: A) - Correct answer: '["b", "c"]' at index 0
UPDATE public.questions
SET options = '["[\"b\", \"c\"]", "[\"a\", \"b\"]", "[\"b\", \"c\", \"d\"]", "[\"c\", \"d\"]"]'::jsonb
WHERE id = 'a1111111-1111-4111-8111-111111111102';

-- Q3 (Target: D) - Correct answer: 'They double capacity...' at index 3
UPDATE public.questions
SET options = '["They store elements in non-contiguous linked memory nodes", "They use a binary heap to balance inserts", "They compress existing elements using bitwise operations", "They double capacity when full, spreading out reallocation cost"]'::jsonb
WHERE id = 'a1111111-1111-4111-8111-111111111103';


-- Challenge 2: Two Pointers & Sliding Window
-- Target distribution: B -> D -> A

-- Q1 (Target: B) - Correct answer: 'Increment the left pointer' at index 1
UPDATE public.questions
SET options = '["Decrement the right pointer", "Increment the left pointer", "Reset both pointers to zero", "Swap the elements at both pointers"]'::jsonb
WHERE id = 'a2222222-2222-4222-8222-222222222201';

-- Q2 (Target: D) - Correct answer: 'O(n) vs O(n²)' at index 3
UPDATE public.questions
SET options = '["O(log n) vs O(n)", "O(1) vs O(n)", "O(n log n) vs O(n²)", "O(n) vs O(n²)"]'::jsonb
WHERE id = 'a2222222-2222-4222-8222-222222222202';

-- Q3 (Target: A) - Correct answer: 'Hash Map (or frequency array)' at index 0
UPDATE public.questions
SET options = '["Hash Map (or frequency array)", "Binary Search Tree", "Linked List", "Stack"]'::jsonb
WHERE id = 'a2222222-2222-4222-8222-222222222203';


-- Challenge 3: Asynchronous JavaScript & Promises
-- Target distribution: D -> B -> C

-- Q1 (Target: D) - Correct answer: 'pending' at index 3
UPDATE public.questions
SET options = '["fulfilled", "rejected", "settled", "pending"]'::jsonb
WHERE id = 'a3333333-3333-4333-8333-333333333301';

-- Q2 (Target: B) - Correct answer: 'Microtask queue' at index 1
UPDATE public.questions
SET options = '["Macrotask queue (Task queue)", "Microtask queue", "Call stack directly", "Worker thread pool"]'::jsonb
WHERE id = 'a3333333-3333-4333-8333-333333333302';

-- Q3 (Target: C) - Correct answer: 'Promise.all()' at index 2
UPDATE public.questions
SET options = '["Promise.allSettled()", "Promise.any()", "Promise.all()", "Promise.race()"]'::jsonb
WHERE id = 'a3333333-3333-4333-8333-333333333303';


-- 4. Targeted Updates: Populate Educational Explanations in quiz_answer_keys
UPDATE public.quiz_answer_keys
SET explanation = 'Contiguous arrays store elements in consecutive memory slots. Given an index i, the computer calculates the physical memory address in a single arithmetic operation: address = base_address + (i * element_size). Accessing any index takes constant time O(1) regardless of array size. O(n) describes linear searching for an unknown value, O(log n) describes binary search in a sorted structure, and O(n²) represents nested loops.'
WHERE question_id = 'a1111111-1111-4111-8111-111111111101';

UPDATE public.quiz_answer_keys
SET explanation = 'In JavaScript, Array.prototype.slice(start, end) extracts elements from the start index (inclusive) up to, but NOT including, the end index (exclusive). Index 1 is "b" and index 2 is "c". Index 3 ("d") is excluded because the upper boundary is exclusive, so the returned subarray is ["b", "c"].'
WHERE question_id = 'a1111111-1111-4111-8111-111111111102';

UPDATE public.quiz_answer_keys
SET explanation = 'When a dynamic array reaches full capacity, it allocates a new buffer of double the size (geometric growth) and copies all elements over. While an individual resize takes O(N) time, doubling capacity ensures resizes happen exponentially less frequently. Inserting N elements requires at most ~2N total copies across all resizes combined, yielding an amortized (average) cost of O(1) per push.'
WHERE question_id = 'a1111111-1111-4111-8111-111111111103';

UPDATE public.quiz_answer_keys
SET explanation = 'In a sorted array, the left pointer points to smaller values and the right pointer points to larger values. If arr[left] + arr[right] < target, the current sum is too small. Because the array is sorted in ascending order, incrementing left (left++) moves to a larger value, which increases the sum toward the target. Decrementing the right pointer would make the sum even smaller.'
WHERE question_id = 'a2222222-2222-4222-8222-222222222201';

UPDATE public.quiz_answer_keys
SET explanation = 'A brute-force nested loop recalculates the subarray state for every start and end index pair, resulting in O(N²) time. The Sliding Window technique maintains the state continuously by adding the newly included right element and subtracting the excluded left element. Both pointers traverse the array at most N times each, achieving linear O(N) time complexity.'
WHERE question_id = 'a2222222-2222-4222-8222-222222222202';

UPDATE public.quiz_answer_keys
SET explanation = 'As the sliding window shifts, elements enter on the right and leave on the left. A Hash Map (or fixed-size integer array for character sets like ASCII) provides O(1) average-case time to insert, increment, decrement, and check character frequencies, keeping the sliding window shift step at O(1) time. Binary search trees take O(log K) and linked lists take O(K).'
WHERE question_id = 'a2222222-2222-4222-8222-222222222203';

UPDATE public.quiz_answer_keys
SET explanation = 'According to the ECMAScript Promise specification, a Promise begins in the pending state upon instantiation. It remains pending until the asynchronous operation completes, at which point it permanently transitions to either fulfilled (with a value) or rejected (with a reason). Settled is not an official state, but an umbrella term for fulfilled or rejected.'
WHERE question_id = 'a3333333-3333-4333-8333-333333333301';

UPDATE public.quiz_answer_keys
SET explanation = 'Promise reactions (.then(), .catch(), .finally()) and await resumptions are scheduled as microtasks in the microtask queue (Jobs queue). The JavaScript engine drains the entire microtask queue at the end of the current task before yielding to the next macrotask (such as setTimeout or I/O events) or rendering the UI.'
WHERE question_id = 'a3333333-3333-4333-8333-333333333302';

UPDATE public.quiz_answer_keys
SET explanation = 'Promise.all() adopts a fail-fast strategy. It waits for all promises to fulfill, returning an array of results. However, if any input promise rejects, Promise.all() immediately rejects with that first rejection reason, discarding pending results. In contrast, Promise.allSettled() never rejects, Promise.any() fulfills on the first resolved promise, and Promise.race() settles on the first settled promise.'
WHERE question_id = 'a3333333-3333-4333-8333-333333333303';


-- 5. Create Dedicated Read-Only RPC: get_quiz_review
CREATE OR REPLACE FUNCTION public.get_quiz_review(
  p_challenge_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attempt public.challenge_attempts%ROWTYPE;
  v_results JSONB := '[]'::jsonb;
  v_q RECORD;
  v_selected TEXT;
  v_correct TEXT;
  v_is_correct BOOLEAN;
  v_correct_count INTEGER := 0;
  v_total_questions INTEGER := 0;
  v_total_points INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to review challenge';
  END IF;

  SELECT * INTO v_attempt
  FROM public.challenge_attempts
  WHERE user_id = v_user_id AND challenge_id = p_challenge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No completed attempt found for this challenge';
  END IF;

  FOR v_q IN
    SELECT q.id, q.question_text, q.points, ak.correct_answer, ak.explanation
    FROM public.questions q
    JOIN public.quiz_answer_keys ak ON ak.question_id = q.id
    WHERE q.challenge_id = p_challenge_id
    ORDER BY q.position ASC
  LOOP
    v_total_questions := v_total_questions + 1;
    v_total_points := v_total_points + COALESCE(v_q.points, 10);
    v_selected := COALESCE(v_attempt.submitted_answers ->> v_q.id::text, '');
    v_correct := COALESCE(v_q.correct_answer, '');

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
      'points', COALESCE(v_q.points, 10),
      'explanation', COALESCE(v_q.explanation, '')
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyCompleted', true,
    'challengeId', p_challenge_id,
    'totalQuestions', COALESCE(v_attempt.total_questions, v_total_questions),
    'correctCount', v_correct_count,
    'score', v_attempt.score,
    'totalPoints', v_total_points,
    'xpEarned', v_attempt.xp_earned,
    'message', 'Review retrieved successfully.',
    'results', v_results,
    'optionsSnapshot', v_attempt.options_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_review(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quiz_review(UUID) TO authenticated;


-- 6. Update submit_quiz to support snapshots and return explanations
DROP FUNCTION IF EXISTS public.submit_quiz(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.submit_quiz(
  p_challenge_id UUID,
  p_answers JSONB,
  p_options_snapshot JSONB DEFAULT NULL
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

  -- C. Transaction advisory lock
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text || p_challenge_id::text));

  -- D. Fetch challenge details
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

  -- Reset question counter
  v_total_questions := 0;

  -- E. Duplicate Check
  SELECT * INTO v_existing_attempt
  FROM public.challenge_attempts
  WHERE user_id = v_user_id AND challenge_id = p_challenge_id;

  IF FOUND THEN
    FOR v_q IN
      SELECT q.id, q.question_text, q.points, ak.correct_answer, ak.explanation
      FROM public.questions q
      JOIN public.quiz_answer_keys ak ON ak.question_id = q.id
      WHERE q.challenge_id = p_challenge_id
      ORDER BY q.position ASC
    LOOP
      v_total_questions := v_total_questions + 1;
      v_total_points := v_total_points + COALESCE(v_q.points, 10);
      v_selected := COALESCE(v_existing_attempt.submitted_answers ->> v_q.id::text, '');
      v_correct := COALESCE(v_q.correct_answer, '');

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
        'points', COALESCE(v_q.points, 10),
        'explanation', COALESCE(v_q.explanation, '')
      );
    END LOOP;

    v_final_xp := 0;
    v_final_level := 1;

    SELECT COALESCE(xp, 0), COALESCE(level, 1)
    INTO v_final_xp, v_final_level
    FROM public.profiles
    WHERE id = v_user_id;

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
      'optionsSnapshot', v_existing_attempt.options_snapshot,
      'newTotalXp', COALESCE(v_final_xp, 0),
      'newLevel', COALESCE(v_final_level, 1)
    );
  END IF;

  -- F. First-time grading
  FOR v_q IN
    SELECT q.id, q.question_text, q.options, q.points, ak.correct_answer, ak.explanation
    FROM public.questions q
    JOIN public.quiz_answer_keys ak ON ak.question_id = q.id
    WHERE q.challenge_id = p_challenge_id
    ORDER BY q.position ASC
  LOOP
    v_total_questions := v_total_questions + 1;
    v_total_points := v_total_points + COALESCE(v_q.points, 10);
    v_selected := TRIM(COALESCE(p_answers ->> v_q.id::text, ''));

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
      'points', COALESCE(v_q.points, 10),
      'explanation', COALESCE(v_q.explanation, '')
    );
  END LOOP;

  -- G. Calculate proportional XP reward
  IF v_total_points > 0 THEN
    v_xp_earned := ROUND((v_score::numeric / v_total_points::numeric) * COALESCE(v_challenge.xp_reward, 50));
  ELSE
    v_xp_earned := 0;
  END IF;

  -- H. Atomic attempt insert
  INSERT INTO public.challenge_attempts (
    user_id,
    challenge_id,
    score,
    total_questions,
    xp_earned,
    submitted_answers,
    options_snapshot,
    completed_at
  )
  VALUES (
    v_user_id,
    p_challenge_id,
    v_score,
    v_total_questions,
    v_xp_earned,
    v_cleaned_answers,
    p_options_snapshot,
    now()
  );

  -- I. Profile XP update
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  v_default_username := NULLIF(TRIM(SPLIT_PART(v_user_email, '@', 1)), '');
  IF v_default_username IS NULL THEN
    v_default_username := 'Learner';
  END IF;

  INSERT INTO public.profiles (
    id,
    username,
    xp,
    level,
    streak,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_default_username,
    v_xp_earned,
    1 + FLOOR((v_xp_earned)::numeric / 100)::integer,
    1,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    xp = COALESCE(public.profiles.xp, 0) + EXCLUDED.xp,
    level = 1 + FLOOR((COALESCE(public.profiles.xp, 0) + EXCLUDED.xp)::numeric / 100)::integer,
    streak = COALESCE(public.profiles.streak, 0) + 1,
    updated_at = now()
  RETURNING xp, level INTO v_final_xp, v_final_level;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyCompleted', false,
    'challengeId', p_challenge_id,
    'totalQuestions', v_total_questions,
    'correctCount', v_correct_count,
    'score', v_score,
    'totalPoints', v_total_points,
    'xpEarned', v_xp_earned,
    'message', 'Quiz submitted successfully!',
    'results', v_results,
    'optionsSnapshot', p_options_snapshot,
    'newTotalXp', v_final_xp,
    'newLevel', v_final_level
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz(UUID, JSONB, JSONB) TO authenticated;

COMMIT;

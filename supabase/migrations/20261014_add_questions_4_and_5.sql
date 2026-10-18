-- ====================================================================
-- LearnQuest: Additive Migration - Seed Questions 4 and 5
-- Date: 2026-10-14
--
-- Target Challenges (3 active seeded challenges):
-- 1. Array & String Fundamentals (c1111111-1111-4111-8111-111111111111)
-- 2. Two Pointers & Sliding Window (c2222222-2222-4222-8222-222222222222)
-- 3. Asynchronous JavaScript & Promises (c3333333-3333-4333-8333-333333333333)
--
-- Safety Guarantees:
-- - Purely additive: inserts exactly 6 new questions (positions 4 and 5)
--   and 6 corresponding answer keys.
-- - Idempotent and repeatable: uses ON CONFLICT (id) DO NOTHING for questions
--   and ON CONFLICT (question_id) DO NOTHING for quiz_answer_keys.
-- - Zero mutations: does NOT modify, reorder, or delete existing questions (positions 1-3).
-- - Zero modifications to completed attempts, profiles, XP, streaks, or levels.
-- - Zero modifications to unseeded / coming-soon challenges.
-- - Fully transactional (BEGIN / COMMIT).
-- ====================================================================

BEGIN;

-- 1. Insert Questions 4 and 5 for the three active challenges
INSERT INTO public.questions (id, challenge_id, question_text, options, position, points, created_at)
VALUES
  -- Challenge 1: Array & String Fundamentals (c1111111-1111-4111-8111-111111111111)
  -- Question 4 (Target answer: B - index 1)
  (
    'a1111111-1111-4111-8111-111111111104',
    'c1111111-1111-4111-8111-111111111111',
    'In JavaScript, what is the key characteristic of primitive strings when performing operations like .concat() or .toUpperCase()?',
    '["Strings are modified in-place to optimize memory utilization", "Strings are immutable, so methods return a new string rather than modifying the original", "Strings are automatically converted into linked lists during transformation", "Strings mutate their internal buffer only if their length remains unchanged"]'::jsonb,
    4,
    10,
    now()
  ),
  -- Question 5 (Target answer: C - index 2)
  (
    'a1111111-1111-4111-8111-111111111105',
    'c1111111-1111-4111-8111-111111111111',
    'Which array operation typically has a worst-case time complexity of O(n) in a standard dynamic array?',
    '["Reading an element at an arbitrary index with arr[i]", "Popping the last element using arr.pop()", "Inserting or removing an element at the beginning using arr.unshift() or arr.shift()", "Updating an existing element at an arbitrary index with arr[i] = val"]'::jsonb,
    5,
    10,
    now()
  ),

  -- Challenge 2: Two Pointers & Sliding Window (c2222222-2222-4222-8222-222222222222)
  -- Question 4 (Target answer: C - index 2)
  (
    'a2222222-2222-4222-8222-222222222204',
    'c2222222-2222-4222-8222-222222222222',
    'In a fixed-size sliding window of length k over an array of size n, how many total window positions are evaluated across the full traversal?',
    '["n * k", "n - k", "n - k + 1", "2n - k"]'::jsonb,
    4,
    15,
    now()
  ),
  -- Question 5 (Target answer: B - index 1)
  (
    'a2222222-2222-4222-8222-222222222205',
    'c2222222-2222-4222-8222-222222222222',
    'When using two pointers moving toward each other (left = 0, right = n - 1) to test if a string is a palindrome, what is the optimal stopping condition?',
    '["left == 0 and right == 0", "left >= right", "left == n - 1", "left + right == n"]'::jsonb,
    5,
    15,
    now()
  ),

  -- Challenge 3: Asynchronous JavaScript & Promises (c3333333-3333-4333-8333-333333333333)
  -- Question 4 (Target answer: A - index 0)
  (
    'a3333333-3333-4333-8333-333333333304',
    'c3333333-3333-4333-8333-333333333333',
    'What does an async function in JavaScript always return, even if its body returns a primitive value like a number or boolean?',
    '["A Promise that resolves with that value", "A generator iterator yielding that value", "The primitive value synchronously without wrapping", "A callback function awaiting execution"]'::jsonb,
    4,
    10,
    now()
  ),
  -- Question 5 (Target answer: D - index 3)
  (
    'a3333333-3333-4333-8333-333333333305',
    'c3333333-3333-4333-8333-333333333333',
    'In a Promise chain, what happens if an error is thrown inside a .then() handler and no error handler (.catch()) is attached?',
    '["The chain automatically retries the failing .then() callback up to three times", "The error is silently ignored and the next .then() receives undefined", "The error is caught and converted into an empty resolved Promise", "The returned Promise is rejected, causing an UnhandledPromiseRejection if unhandled"]'::jsonb,
    5,
    10,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Protected Answer Keys and Explanations
INSERT INTO public.quiz_answer_keys (question_id, correct_answer, explanation)
VALUES
  -- Challenge 1: Array & String Fundamentals
  (
    'a1111111-1111-4111-8111-111111111104',
    'Strings are immutable, so methods return a new string rather than modifying the original',
    'In JavaScript, primitive string values are immutable: once created, their characters and memory buffer cannot be altered. Methods such as .toUpperCase(), .trim(), or .concat() always allocate and return a completely new string, leaving the original string instance unchanged. In-place modification only occurs on mutable data structures like typed arrays or normal arrays.'
  ),
  (
    'a1111111-1111-4111-8111-111111111105',
    'Inserting or removing an element at the beginning using arr.unshift() or arr.shift()',
    'In a contiguous array, elements are stored sequentially without gaps. Inserting or removing an element at index 0 requires shifting all subsequent n elements by one memory position to make room or fill the vacancy, resulting in O(n) time. In contrast, index lookups (arr[i]) and updates (arr[i] = val) take O(1) time, and popping the last element (arr.pop()) takes O(1) time because no elements need to shift.'
  ),

  -- Challenge 2: Two Pointers & Sliding Window
  (
    'a2222222-2222-4222-8222-222222222204',
    'n - k + 1',
    'For an array of length n and a window of size k, the first window spans indices 0 to k - 1, and the final window spans indices n - k to n - 1. Because the starting index ranges from 0 to n - k inclusive, there are exactly (n - k) - 0 + 1 = n - k + 1 valid window positions. For example, in an array of size 5 with k = 3, there are 5 - 3 + 1 = 3 windows: [0..2], [1..3], and [2..4].'
  ),
  (
    'a2222222-2222-4222-8222-222222222205',
    'left >= right',
    'To verify a palindrome, pointers start at both ends (0 and n - 1) and advance toward the center (left++, right--), comparing characters at each step. Once left >= right, all corresponding character pairs have been verified (meeting at the center for odd lengths where left == right, or crossing for even lengths where left > right). Continuing past this condition would redundantly re-check already evaluated pairs in reverse.'
  ),

  -- Challenge 3: Asynchronous JavaScript & Promises
  (
    'a3333333-3333-4333-8333-333333333304',
    'A Promise that resolves with that value',
    'Functions declared with the async keyword always return a Promise. If the function returns a non-promise value (e.g., return 42;), JavaScript automatically wraps it in an immediately resolved Promise (equivalent to Promise.resolve(42)). If the function throws an unhandled exception, it returns a Promise rejected with that error.'
  ),
  (
    'a3333333-3333-4333-8333-333333333305',
    'The returned Promise is rejected, causing an UnhandledPromiseRejection if unhandled',
    'Throwing an exception inside a Promise handler rejects the Promise returned by that .then() call. Rejections propagate down the Promise chain until intercepted by a rejection handler (such as .catch()). If no handler catches the rejection in the event loop turn, the runtime emits an UnhandledPromiseRejection event or warning, and in modern Node.js environments terminates the process.'
  )
ON CONFLICT (question_id) DO NOTHING;

COMMIT;

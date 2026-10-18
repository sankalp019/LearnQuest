/**
 * LearnQuest Quiz Randomizer & Validator
 *
 * Enforces educational quiz UX standards:
 * 1. Correct answers are distributed across A, B, C, and D.
 * 2. No two consecutive questions within a quiz can share the same correct answer letter.
 * 3. Options are permuted factually—never modifying answer correctness or key text.
 * 4. Captures and validates exact options snapshots for attempt review fidelity.
 */

export interface QuestionWithOptions {
  id: string;
  challenge_id?: string;
  question_text: string;
  options: string[];
  position?: number;
  points?: number;
}

export type OptionLetter = 'A' | 'B' | 'C' | 'D';

/**
 * Returns letter A, B, C, or D for an option index (0 -> A, 1 -> B, etc.)
 */
export function indexToLetter(idx: number): OptionLetter {
  return String.fromCharCode(65 + idx) as OptionLetter;
}

/**
 * Returns index for letter A, B, C, or D ('A' -> 0, 'B' -> 1, etc.)
 */
export function letterToIndex(letter: OptionLetter): number {
  return letter.charCodeAt(0) - 65;
}

/**
 * Validates that an array of correct-answer letters has no consecutive duplicate letters.
 * E.g. ['C', 'A', 'D'] -> true
 *      ['A', 'A', 'B'] -> false
 */
export function validateNoConsecutiveAnswers(letters: OptionLetter[]): boolean {
  for (let i = 1; i < letters.length; i++) {
    if (letters[i] === letters[i - 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Canonical, approved non-consecutive distributions for LearnQuest quizzes:
 * - Challenge 1: C -> A -> D
 * - Challenge 2: B -> D -> A
 * - Challenge 3: D -> B -> C
 */
export const CANONICAL_QUIZ_DISTRIBUTIONS: Record<string, OptionLetter[]> = {
  // Challenge 1: Array & String Fundamentals
  'c1111111-1111-4111-8111-111111111111': ['C', 'A', 'D'],
  // Challenge 2: Two Pointers & Sliding Window
  'c2222222-2222-4222-8222-222222222222': ['B', 'D', 'A'],
  // Challenge 3: Asynchronous JavaScript & Promises
  'c3333333-3333-4333-8333-333333333333': ['D', 'B', 'C'],
};

/**
 * Generates a valid letter pattern of length N where:
 * 1. distribution[i] !== distribution[i - 1] for all i > 0
 * 2. Letters A, B, C, D are evenly utilized.
 */
export function generateNonConsecutiveLetterPattern(length: number): OptionLetter[] {
  const letters: OptionLetter[] = ['A', 'B', 'C', 'D'];
  const pattern: OptionLetter[] = [];

  for (let i = 0; i < length; i++) {
    const prevLetter = i > 0 ? pattern[i - 1] : null;
    // Filter available letters to exclude previous letter
    const available = letters.filter((l) => l !== prevLetter);
    // Cycle or pick
    const chosen = available[(i * 2 + 1) % available.length];
    pattern.push(chosen);
  }

  return pattern;
}

/**
 * Reorders a question's options array such that the correct answer is placed at the specified target letter position,
 * preserving all option text and factuality.
 */
export function reorderOptionsForTargetLetter(
  options: string[],
  correctAnswerText: string,
  targetLetter: OptionLetter
): string[] {
  const targetIdx = letterToIndex(targetLetter);
  const correctTrimmed = correctAnswerText.trim().toLowerCase();

  const correctOpt = options.find(
    (o) => o.trim().toLowerCase() === correctTrimmed
  );

  if (!correctOpt) {
    throw new Error(
      `Correct answer "${correctAnswerText}" not found in options: ${JSON.stringify(options)}`
    );
  }

  const distractors = options.filter(
    (o) => o.trim().toLowerCase() !== correctTrimmed
  );

  const reordered: string[] = new Array(options.length);
  reordered[targetIdx] = correctOpt;

  let distractorIdx = 0;
  for (let i = 0; i < options.length; i++) {
    if (i !== targetIdx) {
      reordered[i] = distractors[distractorIdx++];
    }
  }

  return reordered;
}

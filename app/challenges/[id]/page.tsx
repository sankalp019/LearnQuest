'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { Challenge, Question, QuizSubmissionResponse } from '@/lib/types';

function normalizeOptions(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) =>
      typeof item === 'object' && item !== null && 'text' in item
        ? String((item as { text: unknown }).text)
        : String(item)
    );
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return normalizeOptions(parsed);
    } catch {
      return [raw];
    }
  }
  return [];
}

// Shuffle options for each quiz session. Answers are submitted as option text,
// so grading remains tied to the protected answer key rather than the A/B/C/D slot.
function shuffleOptions(options: string[]): string[] {
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function ChallengeQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: challengeId } = use(params);
  const [supabase] = useState(() => createClient());

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [priorCompletion, setPriorCompletion] = useState<{ score: number; xp_earned: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizSubmissionResponse | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email });

          // Check if user has already completed this challenge
          const { data: completion } = await supabase
            .from('challenge_attempts')
            .select('score, xp_earned')
            .eq('user_id', session.user.id)
            .eq('challenge_id', challengeId)
            .maybeSingle();

          if (completion) {
            setPriorCompletion(completion);

            // Automatically load read-only review of completed attempt
            try {
              const reviewRes = await fetch(`/api/challenges/${challengeId}/review`);
              if (reviewRes.ok) {
                const reviewData: QuizSubmissionResponse = await reviewRes.json();
                if (reviewData.ok) {
                  setResult(reviewData);
                }
              }
            } catch (revErr) {
              console.error('Error fetching review:', revErr);
            }
          }
        }

        // 1. Fetch challenge details
        const { data: chData, error: chErr } = await supabase
          .from('challenges')
          .select('*')
          .eq('id', challengeId)
          .single();

        if (chErr || !chData) {
          throw new Error('Challenge not found or unavailable.');
        }
        setChallenge(chData);

        // 2. Fetch questions strictly without exposing correct_answer
        const { data: qData, error: qErr } = await supabase
          .from('questions')
          .select('id, challenge_id, question_text, options, position, points')
          .eq('challenge_id', challengeId)
          .order('position', { ascending: true });

        if (qErr) {
          throw new Error(`Failed to load questions: ${qErr.message}`);
        }

        // A fresh option order per quiz load prevents predictable answer-position patterns.
        // Keep option text unchanged so the server can grade against private answer keys.
        setQuestions((qData || []).map((question) => ({
          ...question,
          options: shuffleOptions(normalizeOptions(question.options)),
        })));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading challenge';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [challengeId, supabase]);

  function handleSelectOption(questionId: string, option: string) {
    if (result) return; // Locked once submitted
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  }

  async function handleSubmitQuiz() {
    if (!user) {
      setError('Please sign in to submit your quiz and earn XP.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const optionsSnapshot: Record<string, string[]> = {};
      for (const q of questions) {
        optionsSnapshot[q.id] = normalizeOptions(q.options);
      }

      const res = await fetch(`/api/challenges/${challengeId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: selectedAnswers,
          optionsSnapshot,
        }),
      });

      const data: QuizSubmissionResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || 'Failed to submit quiz.');
      }

      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const currentQuestion = questions[currentIndex];
  const currentOptions = currentQuestion ? normalizeOptions(currentQuestion.options) : [];
  const answeredCount = Object.keys(selectedAnswers).length;
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
            <p className="mt-4 text-xs font-mono uppercase tracking-wider text-zinc-500">
              Loading challenge...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-5 text-sm text-red-300">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-red-200">Notice</p>
                <p className="mt-1 text-xs text-red-300/90 leading-relaxed">{error}</p>
              </div>
              <Link
                href="/challenges"
                className="text-xs text-red-400 hover:text-red-200 underline ml-4 whitespace-nowrap"
              >
                Back to challenges
              </Link>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && challenge && (
          <div>
            {/* Breadcrumb & Meta */}
            <div className="mb-6 flex items-center justify-between">
              <Link
                href="/challenges"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <span>←</span>
                <span>All Challenges</span>
              </Link>

              <div className="flex items-center gap-2">
                <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-xs font-mono text-zinc-300">
                  {challenge.subject}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-mono font-medium ${
                    challenge.difficulty === 'Easy' || challenge.difficulty === 'beginner'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                      : challenge.difficulty === 'Medium' || challenge.difficulty === 'intermediate'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                        : 'bg-rose-950 text-rose-300 border border-rose-800/50'
                  }`}
                >
                  {challenge.difficulty === 'beginner'
                    ? 'Beginner'
                    : challenge.difficulty === 'intermediate'
                      ? 'Intermediate'
                      : challenge.difficulty === 'advanced'
                        ? 'Advanced'
                        : challenge.difficulty}
                </span>
                <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-mono text-emerald-400">
                  +{challenge.xp_reward} XP
                </span>
              </div>
            </div>

            {/* Prior Completion Banner */}
            {priorCompletion && !result && (
              <div className="mb-6 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4 text-xs text-emerald-300 flex items-center justify-between">
                <span>
                  ✓ You previously completed this challenge (+{priorCompletion.xp_earned} XP earned). Each challenge can only be attempted once.
                </span>
              </div>
            )}

            {/* Auth Required Notice */}
            {!user && (
              <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-xs text-zinc-300 flex items-center justify-between">
                <span>Sign in to save your score, maintain streaks, and earn XP.</span>
                <Link
                  href="/auth"
                  className="rounded bg-emerald-500 px-3 py-1 font-semibold text-zinc-950 hover:bg-emerald-400"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Title & Description */}
            <header className="mb-8 border-b border-zinc-800 pb-6">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {challenge.title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {challenge.description}
              </p>
            </header>

            {/* Results Screen */}
            {result ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase font-mono tracking-widest text-emerald-400">
                        Quiz Completed
                      </p>
                      <h2 className="mt-1 text-2xl font-bold text-white">
                        Performance Summary
                      </h2>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-extrabold font-mono text-white">
                        {result.score} / {result.totalPoints}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {result.correctCount} of {result.totalQuestions} correct
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-800/80 pt-4">
                    {result.alreadyCompleted ? (
                      <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-mono font-semibold text-emerald-300">
                        ✓ Completed (+{result.xpEarned} XP Earned)
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-mono font-semibold text-emerald-300">
                        +{result.xpEarned} XP Awarded!
                      </span>
                    )}

                    {result.newTotalXp !== undefined && (
                      <span className="text-xs text-zinc-400">
                        Current Total: <strong className="text-zinc-200">{result.newTotalXp} XP</strong> (Level {result.newLevel})
                      </span>
                    )}
                  </div>
                </div>

                {/* Per Question Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-400">
                    Question Breakdown & Review
                  </h3>

                  {result.results?.map((res, i) => {
                    const originalQ = questions.find((q) => q.id === res.questionId);
                    const snapshotOptions = result.optionsSnapshot?.[res.questionId];
                    const options = snapshotOptions && snapshotOptions.length > 0
                      ? snapshotOptions
                      : (originalQ ? normalizeOptions(originalQ.options) : []);
                    const explanation = res.explanation || (originalQ as { explanation?: string })?.explanation;

                    return (
                      <div
                        key={res.questionId}
                        className={`rounded-lg border p-5 text-sm ${
                          res.isCorrect
                            ? 'border-emerald-900/60 bg-emerald-950/10'
                            : 'border-rose-900/60 bg-rose-950/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className="font-medium text-white leading-relaxed">
                            <span className="font-mono text-xs text-zinc-500 mr-2">
                              #{i + 1}
                            </span>
                            {res.questionText}
                          </p>
                          <span
                            className={`rounded px-2.5 py-0.5 text-xs font-mono font-semibold shrink-0 ${
                              res.isCorrect
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {res.isCorrect ? `+${res.points} pts` : '0 pts'}
                          </span>
                        </div>

                        {/* All Answer Options with Status Badges */}
                        {options.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                              Answer Options
                            </p>
                            <div className="space-y-1.5">
                              {options.map((opt, optIdx) => {
                                const isSelected = res.selectedAnswer === opt;
                                const isCorrectAnswer =
                                  res.correctAnswer === opt ||
                                  res.correctAnswer.toLowerCase().trim() === opt.toLowerCase().trim();

                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs transition-colors ${
                                      isCorrectAnswer
                                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                                        : isSelected && !res.isCorrect
                                          ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
                                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span
                                        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-mono font-bold ${
                                          isCorrectAnswer
                                            ? 'bg-emerald-500 text-zinc-950'
                                            : isSelected && !res.isCorrect
                                              ? 'bg-rose-500 text-white'
                                              : 'bg-zinc-800 text-zinc-400'
                                        }`}
                                      >
                                        {String.fromCharCode(65 + optIdx)}
                                      </span>
                                      <span className="font-medium">{opt}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                      {isSelected && (
                                        <span
                                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                                            res.isCorrect
                                              ? 'bg-emerald-500/20 text-emerald-300'
                                              : 'bg-rose-500/20 text-rose-300'
                                          }`}
                                        >
                                          Your Choice
                                        </span>
                                      )}
                                      {isCorrectAnswer && (
                                        <span className="rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-mono font-semibold">
                                          ✓ Correct Answer
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Selection & Correct Answer Summary */}
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
                          <div className="rounded bg-zinc-900/80 p-2.5">
                            <p className="text-zinc-500 font-mono text-[11px] uppercase">
                              Your Selection
                            </p>
                            <p
                              className={`mt-1 font-medium ${
                                res.isCorrect ? 'text-emerald-300' : 'text-rose-300 line-through'
                              }`}
                            >
                              {res.selectedAnswer || '(No answer provided)'}
                            </p>
                          </div>
                          <div className="rounded bg-zinc-900/80 p-2.5">
                            <p className="text-zinc-500 font-mono text-[11px] uppercase">
                              Correct Answer
                            </p>
                            <p className="mt-1 font-medium text-emerald-300">
                              {res.correctAnswer}
                            </p>
                          </div>
                        </div>

                        {/* Explanation (Rendered if present in data) */}
                        {explanation && (
                          <div className="mt-3 rounded border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                            <p className="font-semibold text-zinc-400 text-[11px] font-mono uppercase">
                              💡 Explanation
                            </p>
                            <p className="mt-1 leading-relaxed text-zinc-300">{explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Navigation */}
                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-6">
                  <Link
                    href="/challenges"
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                  >
                    ← Browse More Challenges
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
                  >
                    View Student Dashboard →
                  </Link>
                </div>
              </div>
            ) : priorCompletion ? (
              /* Already completed fallback if review payload couldn't be loaded */
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
                <p className="text-base font-semibold text-white">
                  Challenge Already Completed
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  You have already completed this challenge (+{priorCompletion.xp_earned} XP earned). Attempts are limited to one per challenge.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Link
                    href="/challenges"
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                  >
                    ← Browse Challenges
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
                  >
                    View Dashboard →
                  </Link>
                </div>
              </div>
            ) : questions.length === 0 ? (
              /* Empty Questions State */
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
                <p className="text-base font-semibold text-white">
                  No Questions Available
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  Questions have not been seeded for this challenge yet. Run the SQL migration in Supabase to populate them.
                </p>
                <Link
                  href="/challenges"
                  className="mt-6 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  Back to catalog
                </Link>
              </div>
            ) : (
              /* Interactive Question Runner */
              <div>
                {/* Step Indicator & Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <span>
                      {answeredCount} of {questions.length} answered
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${((currentIndex + 1) / questions.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Question Body */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg font-medium text-white sm:text-xl leading-snug">
                      {currentQuestion.question_text}
                    </h2>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-400 shrink-0">
                      {currentQuestion.points} pts
                    </span>
                  </div>

                  {/* Options */}
                  <fieldset className="mt-6 space-y-3">
                    <legend className="sr-only">Answer options</legend>
                    {currentOptions.map((option, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestion.id] === option;
                      return (
                        <label
                          key={optIdx}
                          className={`flex items-center justify-between rounded-lg border p-4 text-sm cursor-pointer transition-all ${
                            isSelected
                              ? 'border-emerald-500/80 bg-emerald-500/5 text-white ring-1 ring-emerald-500/30'
                              : 'border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs font-mono ${
                                isSelected
                                  ? 'border-emerald-400 bg-emerald-500 text-zinc-950 font-bold'
                                  : 'border-zinc-700 text-zinc-400'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="font-medium leading-relaxed">
                              {option}
                            </span>
                          </div>
                          <input
                            type="radio"
                            name={`question-${currentQuestion.id}`}
                            value={option}
                            checked={isSelected}
                            onChange={() => handleSelectOption(currentQuestion.id, option)}
                            className="sr-only"
                          />
                        </label>
                      );
                    })}
                  </fieldset>
                </div>

                {/* Controls */}
                <div className="mt-8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                    disabled={currentIndex === 0}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>

                  <div className="flex items-center gap-3">
                    {!isLastQuestion ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentIndex((idx) =>
                            Math.min(questions.length - 1, idx + 1)
                          )
                        }
                        className="rounded-lg bg-zinc-800 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitQuiz}
                        disabled={submitting}
                        className="rounded-lg bg-emerald-500 px-6 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting ? 'Submitting & Grading...' : 'Submit Quiz'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

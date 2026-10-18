'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { Challenge, Difficulty } from '@/lib/types';

interface ChallengeWithMeta extends Challenge {
  questions?: { id: string }[];
  questionCount?: number;
}

export default function ChallengesPage() {
  const [supabase] = useState(() => createClient());

  const [challenges, setChallenges] = useState<ChallengeWithMeta[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');

  useEffect(() => {
    async function fetchChallenges() {
      setLoading(true);
      setError(null);

      try {
        // Fetch session to retrieve completions
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: completions } = await supabase
            .from('challenge_attempts')
            .select('challenge_id')
            .eq('user_id', session.user.id);

          if (completions) {
            setCompletedIds(new Set(completions.map((c) => c.challenge_id)));
          }
        }

        // Fetch published challenges with question relations
        const { data, error: fetchErr } = await supabase
          .from('challenges')
          .select('*, questions(id)')
          .eq('is_published', true)
          .order('created_at', { ascending: true });

        if (fetchErr) {
          throw new Error(fetchErr.message);
        }

        const rawItems = (data || []) as unknown as (Challenge & { questions?: { id: string }[] })[];
        const items: ChallengeWithMeta[] = rawItems.map((c) => ({
          ...c,
          questionCount: Array.isArray(c.questions) ? c.questions.length : 0,
        }));

        // Display seeded challenges with questions first, followed by unseeded
        items.sort((a, b) => {
          const aHas = (a.questionCount ?? 0) > 0 ? 1 : 0;
          const bHas = (b.questionCount ?? 0) > 0 ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        setChallenges(items);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error fetching challenges';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchChallenges();
  }, [supabase]);

  const subjects = ['All', ...Array.from(new Set(challenges.map((c) => c.subject).filter(Boolean)))];
  const difficulties: ('All' | Difficulty)[] = ['All', 'Easy', 'Medium', 'Hard'];

  const filteredChallenges = challenges.filter((c) => {
    const matchesSubject = selectedSubject === 'All' || c.subject === selectedSubject;
    const matchesDiff =
      selectedDifficulty === 'All' ||
      c.difficulty?.toLowerCase() === selectedDifficulty.toLowerCase() ||
      (selectedDifficulty === 'Easy' && c.difficulty === 'beginner') ||
      (selectedDifficulty === 'Medium' && c.difficulty === 'intermediate') ||
      (selectedDifficulty === 'Hard' && c.difficulty === 'advanced');
    return matchesSubject && matchesDiff;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800 pb-8">
          <div>
            <p className="text-xs uppercase font-mono tracking-widest text-emerald-400">
              LEARNQUEST CHALLENGES
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Curated Problem Sets
            </h1>
            <p className="mt-2 text-sm text-zinc-400 max-w-xl">
              Solve interactive quizzes, master computer science fundamentals, and earn XP to level up your profile.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-mono text-zinc-400">
              {challenges.filter((c) => (c.questionCount ?? 0) > 0).length} Ready · {challenges.length} Total
            </span>
            <span className="rounded-full border border-emerald-900/50 bg-emerald-950/40 px-3 py-1 text-xs font-mono text-emerald-400">
              {completedIds.size} Completed
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          {/* Subject Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {subjects.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubject(sub)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedSubject === sub
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Difficulty Dropdown / Pills */}
          <div className="flex items-center gap-1.5">
            {difficulties.map((diff) => (
              <button
                key={diff}
                type="button"
                onClick={() => setSelectedDifficulty(diff)}
                className={`rounded-md px-2.5 py-1 text-xs font-mono transition-colors ${
                  selectedDifficulty === diff
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Challenge List */}
        <div className="mt-8">
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 animate-pulse"
                />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-sm text-red-300">
              <p className="font-semibold text-red-200">Unable to load challenges</p>
              <p className="mt-1 text-xs text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && filteredChallenges.length === 0 && challenges.length === 0 && (
            /* Database not yet seeded empty state */
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
              <span className="inline-block rounded-full bg-zinc-800/80 p-3 text-zinc-400 mb-3">
                📚
              </span>
              <h2 className="text-base font-semibold text-white">
                No Challenges Seeded Yet
              </h2>
              <p className="mt-2 text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                The database table <code className="font-mono text-zinc-300">challenges</code> exists in Supabase but currently contains 0 rows.
              </p>
              <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4 max-w-lg mx-auto text-left">
                <p className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                  Quick Setup via SQL Editor
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Run the migration file located at:
                </p>
                <code className="mt-2 block rounded bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-200">
                  supabase/migrations/20261013_challenges_quizzes.sql
                </code>
              </div>
            </div>
          )}

          {!loading && !error && filteredChallenges.length === 0 && challenges.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-400">
              No challenges match your selected filters. Try clearing filters.
            </div>
          )}

          {!loading && !error && filteredChallenges.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredChallenges.map((challenge) => {
                const isCompleted = completedIds.has(challenge.id);
                const hasQuestions = (challenge.questionCount ?? 0) > 0;

                return (
                  <article
                    key={challenge.id}
                    className={`flex flex-col justify-between rounded-xl border p-6 transition-colors ${
                      hasQuestions
                        ? 'border-zinc-800/90 bg-zinc-900/40 hover:border-zinc-700/80'
                        : 'border-zinc-800/50 bg-zinc-900/20 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Meta header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                          {challenge.subject}
                        </span>

                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-mono font-medium ${
                              challenge.difficulty === 'Easy' || challenge.difficulty === 'beginner'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                                : challenge.difficulty === 'Medium' || challenge.difficulty === 'intermediate'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800/40'
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

                          <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-400">
                            +{challenge.xp_reward} XP
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h2 className="mt-4 text-base font-semibold text-white">
                        {challenge.title}
                      </h2>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400 line-clamp-2">
                        {challenge.description}
                      </p>
                    </div>

                    {/* Footer CTA */}
                    <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
                      {hasQuestions ? (
                        <>
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400">
                              <span>✓</span>
                              <span>Completed</span>
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500 font-mono">
                              Ready to start
                            </span>
                          )}

                          <Link
                            href={`/challenges/${challenge.id}`}
                            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                              isCompleted
                                ? 'border border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700'
                                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                            }`}
                          >
                            {isCompleted ? 'Review Quiz' : 'Start Quiz →'}
                          </Link>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-zinc-500 font-mono">
                            Questions coming soon
                          </span>

                          <button
                            type="button"
                            disabled
                            className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs font-semibold text-zinc-500 cursor-not-allowed"
                            title="Questions have not been seeded for this challenge yet."
                          >
                            Coming Soon
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

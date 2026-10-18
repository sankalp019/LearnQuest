'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { Challenge, ChallengeCompletion, Profile } from '@/lib/types';

export default function Dashboard() {
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completions, setCompletions] = useState<
    (ChallengeCompletion & { challenge?: Challenge })[]
  >([]);
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setUser(null);
          setLoading(false);
          return;
        }

        const currentUser = {
          id: session.user.id,
          email: session.user.email,
        };
        setUser(currentUser);

        // 1. Fetch or initialize profile
        const { data: existingProfile, error: profileSelectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileSelectError) {
          console.error('Error fetching profile:', profileSelectError);
        } else if (existingProfile) {
          setProfile(existingProfile);
        } else {
          // Initialize empty profile for authenticated user
         const initialProfile: Profile = {
  id: currentUser.id,
  username:
    session.user.user_metadata?.username ||
    currentUser.email?.split('@')[0] ||
    'Learner',
  xp: 0,
  level: 1,
  streak: 0,
  role: 'student',
  campus_id: null,
  avatar_url: null,
  last_activity_date: null,
  created_at: new Date().toISOString(),
};

          const { error: profileInsertError } = await supabase
            .from('profiles')
            .insert(initialProfile);

          if (!profileInsertError) {
            setProfile(initialProfile);
          } else {
            console.error('Profile insertion error:', profileInsertError);
            // If another request created the profile concurrently, fetch and use it
            const { data: concurrentProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();

            if (concurrentProfile) {
              setProfile(concurrentProfile);
            }
          }
        }

        // 2. Fetch all published challenges
        const { data: allChallenges } = await supabase
          .from('challenges')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: true });

        const challengesList = allChallenges || [];

        // 3. Fetch user completions
        const { data: completionRecords } = await supabase
          .from('challenge_attempts')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('completed_at', { ascending: false });

        const userCompletions = completionRecords || [];
        const completedIds = new Set(userCompletions.map((c) => c.challenge_id));

        // Attach challenge meta to completions
        const completionsWithMeta = userCompletions.map((comp) => ({
          ...comp,
          challenge: challengesList.find((c) => c.id === comp.challenge_id),
        }));
        setCompletions(completionsWithMeta);

        // Filter uncompleted challenges
        setAvailableChallenges(
          challengesList.filter((c) => !completedIds.has(c.id))
        );
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [supabase]);

  // Level Progression calculations
  const currentXp = profile?.xp || 0;
  const currentLevel = profile?.level || 1;
  const xpCurrentLevelBase = (currentLevel - 1) * 100;
  const xpNextLevelTarget = currentLevel * 100;
  const xpIntoCurrentLevel = Math.max(0, currentXp - xpCurrentLevelBase);
  const progressPercent = Math.min(100, Math.round((xpIntoCurrentLevel / 100) * 100));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-12">
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
            <p className="mt-4 text-xs font-mono uppercase tracking-wider text-zinc-500">
              Loading dashboard...
            </p>
          </div>
        ) : !user ? (
          /* Unauthenticated state */
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center max-w-md mx-auto">
            <p className="text-xs uppercase font-mono tracking-widest text-emerald-400">
              AUTHENTICATION REQUIRED
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">
              Student Dashboard
            </h1>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Log in to track your learning journey, view earned XP, and monitor your skill streaks.
            </p>
            <Link
              href="/auth"
              className="mt-6 inline-block rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              Sign In to Your Account
            </Link>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800 pb-8">
              <div>
                <p className="text-xs uppercase font-mono tracking-widest text-emerald-400">
                  STUDENT PORTAL
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {profile?.username ? `${profile.username}'s Dashboard` : 'Your Learning Dashboard'}
                </h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Solve quizzes, build daily streaks, and conquer CS benchmarks.
                </p>
              </div>

              <Link
                href="/challenges"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
              >
                <span>Browse Challenges</span>
                <span>→</span>
              </Link>
            </div>

            {/* Core Stats Grid */}
            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              {/* XP */}
              <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-5">
                <span className="text-xs font-mono uppercase text-zinc-500">
                  Total XP
                </span>
                <p className="mt-2 text-3xl font-extrabold font-mono text-emerald-400">
                  {currentXp}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400 font-mono">
                  {xpNextLevelTarget - currentXp} XP until Level {currentLevel + 1}
                </p>
              </div>

              {/* Level & Progress */}
              <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-5">
                <span className="text-xs font-mono uppercase text-zinc-500">
                  Current Level
                </span>
                <p className="mt-2 text-3xl font-extrabold font-mono text-white">
                  {currentLevel}
                </p>
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500 font-mono text-right">
                    {progressPercent}% towards Lvl {currentLevel + 1}
                  </p>
                </div>
              </div>

              {/* Streak */}
              <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-5">
                <span className="text-xs font-mono uppercase text-zinc-500">
                  Learning Streak
                </span>
                <p className="mt-2 text-3xl font-extrabold font-mono text-amber-400">
                  {profile?.streak || 0} <span className="text-sm font-normal text-zinc-500">days</span>
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Complete a challenge today to maintain
                </p>
              </div>

              {/* Completed Count */}
              <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-5">
                <span className="text-xs font-mono uppercase text-zinc-500">
                  Quizzes Completed
                </span>
                <p className="mt-2 text-3xl font-extrabold font-mono text-white">
                  {completions.length}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {availableChallenges.length} more available
                </p>
              </div>
            </div>

            {/* LEARNQUEST_ACHIEVEMENTS_V1 */}
            {(() => {
              const completedToday = completions.some(
                (item) =>
                  new Date(item.completed_at).toDateString() ===
                  new Date().toDateString()
              );

              const achievements = [
                {
                  title: 'First Steps',
                  detail: 'Complete your first challenge',
                  unlocked: completions.length >= 1,
                  icon: '01',
                },
                {
                  title: 'Knowledge Seeker',
                  detail: 'Complete 5 challenges',
                  unlocked: completions.length >= 5,
                  icon: '05',
                },
                {
                  title: 'Dedicated Learner',
                  detail: 'Complete 10 challenges',
                  unlocked: completions.length >= 10,
                  icon: '10',
                },
                {
                  title: 'XP Collector',
                  detail: 'Earn 500 XP',
                  unlocked: currentXp >= 500,
                  icon: 'XP',
                },
              ];

              return (
                <>
                  <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-zinc-900/80 to-zinc-900/40 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">
                            DAILY MISSION
                          </p>
                          <h2 className="mt-3 text-xl font-bold text-white">
                            {completedToday
                              ? 'Mission accomplished'
                              : 'Complete one challenge'}
                          </h2>
                          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">
                            {completedToday
                              ? 'You have completed a challenge today. Keep learning to build your record.'
                              : 'Choose an available quiz, test your knowledge, and earn its listed XP reward.'}
                          </p>
                        </div>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-xl text-emerald-400">
                          {completedToday ? '✓' : '→'}
                        </div>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-zinc-700/60 pt-4">
                        <span className="text-xs text-zinc-500">
                          {completedToday ? 'TODAY · COMPLETE' : 'TODAY · IN PROGRESS'}
                        </span>
                        <Link
                          href={completedToday ? '/challenges' : `/challenges/${availableChallenges[0]?.id || ''}`}
                          className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-300"
                        >
                          {completedToday
                            ? 'Keep learning →'
                            : availableChallenges.length > 0
                              ? 'Start mission →'
                              : 'View challenges →'}
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                        YOUR NEXT MILESTONE
                      </p>
                      <h2 className="mt-3 text-xl font-bold text-white">
                        {completions.length < 1
                          ? 'First challenge'
                          : completions.length < 5
                            ? 'Knowledge Seeker'
                            : completions.length < 10
                              ? 'Dedicated Learner'
                              : currentXp < 500
                                ? 'XP Collector'
                                : 'Keep mastering'}
                      </h2>
                      <p className="mt-2 text-sm text-zinc-400">
                        {completions.length < 1
                          ? 'Finish one challenge to unlock your first achievement.'
                          : completions.length < 5
                            ? `${5 - completions.length} more challenge(s) to reach 5 completed.`
                            : completions.length < 10
                              ? `${10 - completions.length} more challenge(s) to reach 10 completed.`
                              : currentXp < 500
                                ? `${500 - currentXp} XP until the XP Collector milestone.`
                                : 'Your next goal is to keep building your skills.'}
                      </p>
                      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all"
                          style={{
                            width: `${Math.min(100, completions.length < 1 ? 0 : completions.length < 5 ? completions.length / 5 * 100 : completions.length < 10 ? completions.length / 10 * 100 : currentXp < 500 ? currentXp / 500 * 100 : 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="mt-10">
                    <div className="flex items-end justify-between border-b border-zinc-800 pb-3">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400">
                          RECOGNITION
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-white">
                          Achievements
                        </h2>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {achievements.filter((a) => a.unlocked).length} / {achievements.length} unlocked
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {achievements.map((achievement) => (
                        <div
                          key={achievement.title}
                          className={`rounded-xl border p-4 transition ${
                            achievement.unlocked
                              ? 'border-amber-400/25 bg-amber-400/5'
                              : 'border-zinc-800 bg-zinc-900/30 opacity-65'
                          }`}
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg border font-mono text-sm font-bold ${
                            achievement.unlocked
                              ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-500'
                          }`}>
                            {achievement.unlocked ? achievement.icon : '—'}
                          </div>
                          <h3 className="mt-3 text-sm font-semibold text-white">
                            {achievement.title}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            {achievement.detail}
                          </p>
                          <p className={`mt-3 text-[10px] font-mono uppercase tracking-wider ${
                            achievement.unlocked ? 'text-amber-300' : 'text-zinc-600'
                          }`}>
                            {achievement.unlocked ? 'Unlocked' : 'Locked'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              );
            })()}

            {/* Next Recommended Challenges */}
            <section className="mt-12">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h2 className="text-base font-semibold text-white">
                  Available Challenges
                </h2>
                <Link
                  href="/challenges"
                  className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
                >
                  View all ({availableChallenges.length}) →
                </Link>
              </div>

              {availableChallenges.length === 0 ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-400">
                  {completions.length > 0
                    ? '🎉 You have completed all published challenges! Check back soon for new problem sets.'
                    : 'No challenges available right now. Run the migration script in Supabase to seed challenges.'}
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {availableChallenges.slice(0, 3).map((ch) => (
                    <div
                      key={ch.id}
                      className="flex flex-col justify-between rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-5 hover:border-zinc-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-zinc-400">
                            {ch.subject}
                          </span>
                          <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                            +{ch.xp_reward} XP
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-white">
                          {ch.title}
                        </h3>
                        <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                          {ch.description}
                        </p>
                      </div>

                      <Link
                        href={`/challenges/${ch.id}`}
                        className="mt-5 rounded-lg bg-zinc-800 px-3 py-1.5 text-center text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        Start Challenge →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Completed Challenges History */}
            {completions.length > 0 && (
              <section className="mt-12">
                <div className="border-b border-zinc-800/80 pb-3">
                  <h2 className="text-base font-semibold text-white">
                    Completed Challenges History
                  </h2>
                </div>

                <div className="mt-4 divide-y divide-zinc-800/60 rounded-xl border border-zinc-800/90 bg-zinc-900/30">
                  {completions.map((comp) => (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between p-4 text-xs"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {comp.challenge?.title || 'Challenge'}
                        </p>
                        <p className="mt-0.5 text-zinc-500 font-mono text-[11px]">
                          Completed on {new Date(comp.completed_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono text-zinc-400">
                          Score: {comp.score}
                        </span>
                        <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono text-emerald-400 font-semibold">
                          +{comp.xp_earned} XP
                        </span>
                        <Link
                          href={`/challenges/${comp.challenge_id}`}
                          className="text-zinc-400 hover:text-white underline text-[11px]"
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

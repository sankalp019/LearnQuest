
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type LeaderboardEntry = {
  user_id: string;
  username: string;
  xp: number;
  level: number;
  avatar_url: string | null;
  avatarPreview?: string | null;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadLeaderboard() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setError('Please sign in to view the leaderboard.');
          return;
        }

        const { data, error: leaderboardError } = await supabase.rpc(
          'get_leaderboard_with_avatars'
        );

        if (leaderboardError) {
          console.error('Leaderboard error:', leaderboardError);
          setError('Could not load the leaderboard. Please try again.');
          return;
        }

        const rows = (data ?? []) as LeaderboardEntry[];

        const entriesWithAvatars = await Promise.all(
          rows.map(async (entry) => {
            if (!entry.avatar_url) {
              return { ...entry, avatarPreview: null };
            }

            const { data: signedData, error: signedError } =
              await supabase.storage
                .from('profile-avatars')
                .createSignedUrl(entry.avatar_url, 3600);

            if (signedError) {
              console.error(
                `Could not load avatar for ${entry.username}:`,
                signedError.message
              );
            }

            return {
              ...entry,
              avatarPreview: signedData?.signedUrl ?? null,
            };
          })
        );

        setEntries(entriesWithAvatars);
      } catch (err) {
        console.error('Unexpected leaderboard error:', err);
        setError('Something went wrong while loading the leaderboard.');
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="text-sm text-emerald-400 hover:text-emerald-300"
        >
          ← Back to Dashboard
        </Link>

        <div className="mb-8 mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
            LearnQuest Rankings
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Leaderboard
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Learn more, earn XP, and climb the rankings.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-sm text-zinc-400">
            Loading leaderboard...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-6">
            <p className="text-sm text-red-300">{error}</p>
            <Link
              href="/auth"
              className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300"
            >
              Go to Sign In
            </Link>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8">
            <h2 className="font-semibold">No rankings yet</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Complete a challenge to start earning XP.
            </p>
            <Link
              href="/challenges"
              className="mt-5 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Explore Challenges
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_80px_72px] gap-3 border-b border-zinc-800 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:grid-cols-[72px_minmax(0,1fr)_120px_100px] sm:px-6">
              <span>Rank</span>
              <span>Student</span>
              <span className="text-right">XP</span>
              <span className="text-right">Level</span>
            </div>

            {entries.map((entry, index) => (
              <div
                key={entry.user_id}
                className="grid grid-cols-[56px_minmax(0,1fr)_80px_72px] items-center gap-3 border-b border-zinc-800/70 px-4 py-4 last:border-b-0 sm:grid-cols-[72px_minmax(0,1fr)_120px_100px] sm:px-6"
              >
                <span className="font-mono text-sm text-zinc-500">
                  #{index + 1}
                </span>

                <div className="flex min-w-0 items-center gap-3">
                  {entry.avatarPreview ? (
                    <img
                      src={entry.avatarPreview}
                      alt={`${entry.username}'s profile`}
                      className="h-10 w-10 shrink-0 rounded-full border border-zinc-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm font-semibold text-emerald-300">
                      {entry.username.trim().charAt(0).toUpperCase() || 'L'}
                    </div>
                  )}

                  <span className="truncate text-sm font-medium text-zinc-100">
                    {entry.username}
                  </span>
                </div>

                <span className="text-right font-mono text-sm font-semibold text-emerald-400">
                  {entry.xp}
                </span>

                <span className="text-right font-mono text-sm text-zinc-300">
                  {entry.level}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-zinc-600">
          Rankings are based on stored XP. Showing up to 100 students.
        </p>
      </div>
    </main>
  );
}

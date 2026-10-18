'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function redirectByRole() {
    const { data: { user }, error: userError } =
      await supabase.auth.getUser();

    if (userError || !user) {
      setMessage('Could not verify your account. Please try again.');
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      setMessage('Could not load your account role. Contact the administrator.');
      return;
    }

    const destinations: Record<string, string> = {
      super_admin: '/admin',
      campus_admin: '/campus-admin',
      teacher: '/faculty',
      student: '/dashboard',
    };

    router.replace(destinations[profile.role] ?? '/dashboard');
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage('');

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        await redirectByRole();
      }
    } else {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        if (signUpData?.session && signUpData.user) {
          // Initialize profile immediately if auto-authenticated
          await supabase.from('profiles').insert({
            id: signUpData.user.id,
            username: username || email.split('@')[0],
            xp: 0,
            level: 1,
            streak: 0,
          });
          router.push('/dashboard');
          return;
        }

        setMessage(
          'Account created. Check your email if confirmation is required, or log in.'
        );
      }
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>←</span>
            <span>Back to Home</span>
          </Link>
        </div>

        <div className="mb-8 text-center">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-emerald-400">
            LEARNQUEST
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            {isLogin
              ? 'Log in to continue your learning journey.'
              : 'Start earning XP and completing challenges.'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
        >
          {!isLogin && (
            <div className="mb-4">
              <label className="mb-2 block text-sm text-zinc-300">
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                placeholder="Your username"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block text-sm text-zinc-300">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm text-zinc-300">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : isLogin
                ? 'Log In'
                : 'Create Account'}
          </button>

          {message && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              {message}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setMessage('');
          }}
          className="mt-5 w-full text-center text-sm text-zinc-400 hover:text-white"
        >
          {isLogin
            ? "Don't have an account? Create one"
            : 'Already have an account? Log in'}
        </button>
      </div>
    </main>
  );
}

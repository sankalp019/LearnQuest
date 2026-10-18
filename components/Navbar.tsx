
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';

type NavbarProfile = Profile & {
  avatar_url?: string | null;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [supabase] = useState(() => createClient());

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<NavbarProfile | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        setUser(null);
        setProfile(null);
        setAvatarPreview('');
        return;
      }

      setUser({ id: currentUser.id, email: currentUser.email });

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Navbar profile load error:', error.message);
        return;
      }

      setProfile(data as NavbarProfile | null);

      const avatarPath = data?.avatar_url;

      if (avatarPath) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('profile-avatars')
          .createSignedUrl(avatarPath, 3600);

        if (signedError) {
          console.error('Navbar avatar load error:', signedError.message);
          setAvatarPreview('');
        } else {
          setAvatarPreview(signedData.signedUrl);
        }
      } else {
        setAvatarPreview('');
      }
    } catch (error) {
      console.error('Navbar load error:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    async function initialLoad() {
      await loadUser();
    }

    initialLoad();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (active) {
        setTimeout(() => {
          if (active) void loadUser();
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadUser]);

  // Reload profile data when navigating to /profile so the avatar and
  // username are always fresh after a profile edit.
  useEffect(() => {
    if (pathname !== '/profile') return;

    async function reloadOnProfile() {
      await loadUser();
    }

    void reloadOnProfile();
  }, [pathname, loadUser]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAvatarPreview('');
    router.push('/');
    router.refresh();
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/community', label: 'Clubs & events' },
    { href: '/challenges', label: 'Challenges' },
    { href: '/leaderboard', label: 'Leaderboard' },
    ...(profile?.role === 'teacher' ? [{ href: '/faculty', label: 'Faculty' }] : []),
    ...(profile?.role === 'campus_admin' ? [{ href: '/campus-admin', label: 'Admin' }] : []),
    ...(profile?.role === 'super_admin' ? [{ href: '/admin', label: 'Superadmin' }] : []),
    { href: '/profile', label: 'Profile' },
  ];

  const displayName =
    profile?.username?.trim() ||
    user?.email?.split('@')[0] ||
    'Learner';

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-wider text-white transition-colors hover:text-emerald-400"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10 font-mono text-xs font-bold text-emerald-400">
              LQ
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-100">
              LearnQuest
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {navLinks.map((link) => {
              const active =
                pathname === link.href ||
                pathname?.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {loading ? (
            <div className="h-7 w-20 animate-pulse rounded bg-zinc-800/60" />
          ) : user ? (
            <>
              <Link
                href="/profile"
                aria-label="Open your profile"
                title={displayName}
                className="flex max-w-36 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1 pr-2.5 transition-colors hover:border-emerald-500/50 sm:max-w-48"
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-400">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate text-xs font-medium text-zinc-200">
                  {displayName}
                </span>
              </Link>

              {profile && (
                <div className="hidden items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs md:flex">
                  <span className="font-mono font-semibold text-emerald-400">
                    {profile.xp} XP
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="font-mono text-zinc-400">
                    Lvl {profile.level}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white sm:px-3"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-md bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

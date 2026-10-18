
'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'profile-avatars';
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export default function ProfilePage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [avatarPath, setAvatarPath] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [leaderboardAnonymous, setLeaderboardAnonymous] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  async function refreshAvatar(path: string) {
    if (!path) {
      setAvatarPreview('');
      return;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    if (error) {
      setAvatarPreview('');
      console.error('Could not load profile picture:', error.message);
      return;
    }

    setAvatarPreview(data.signedUrl);
  }

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || !user) {
          router.replace('/auth');
          return;
        }

        setUserId(user.id);

        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url, leaderboard_anonymous')
          .eq('id', user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setErrorMessage(error.message);
        } else {
          setLeaderboardAnonymous(Boolean(data?.leaderboard_anonymous));
          setUsername(
            data?.username ||
              user.user_metadata?.username ||
              user.email?.split('@')[0] ||
              ''
          );

          const path = data?.avatar_url || '';
          setAvatarPath(path);

          if (path) {
            const { data: signed, error: signedError } =
              await supabase.storage
                .from(BUCKET)
                .createSignedUrl(path, 3600);

            if (active) {
              if (signedError) {
                setErrorMessage(
                  'Could not load your picture. Try uploading it again.'
                );
              } else {
                setAvatarPreview(signed.signedUrl);
              }
            }
          }
        }
      } catch {
        if (active) setErrorMessage('Could not load your profile.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handlePrivacyChange(nextValue: boolean) {
    setMessage('');
    setErrorMessage('');
    setSavingPrivacy(true);
    try {
      const { data, error } = await supabase.rpc('set_leaderboard_anonymous', { p_anonymous: nextValue });
      if (error) throw error;
      setLeaderboardAnonymous(Boolean(data));
      setMessage(nextValue ? 'Your public leaderboard identity is now hidden.' : 'Your username can appear on public leaderboards again.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update leaderboard privacy. Apply the latest database migrations and try again.');
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    const cleanUsername = username.trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      setErrorMessage('Username must be between 3 and 24 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      setErrorMessage(
        'Use only letters, numbers, underscores, and hyphens.'
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: cleanUsername,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('username')
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message);
      } else if (!data) {
        setErrorMessage('Profile was not updated. Please sign in again.');
      } else {
        setUsername(data.username || cleanUsername);
        setMessage('Profile updated successfully.');
        router.refresh();
      }
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setMessage('');
    setErrorMessage('');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Choose a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('Your image must be 2 MB or smaller.');
      return;
    }

    if (!userId) {
      setErrorMessage('Please sign in again before uploading.');
      return;
    }

    setUploading(true);

    let uploadedPath = '';

    try {
      const extension =
        file.type === 'image/jpeg'
          ? 'jpg'
          : file.type === 'image/png'
            ? 'png'
            : 'webp';

      uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(uploadedPath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: uploadedPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('avatar_url')
        .maybeSingle();

      if (updateError || !updatedProfile) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]);

        throw new Error(
          updateError?.message ||
            'Could not save the picture to your profile.'
        );
      }

      const previousPath = avatarPath;

      setAvatarPath(uploadedPath);
      await refreshAvatar(uploadedPath);

      if (previousPath && previousPath !== uploadedPath) {
        const { error: deleteError } = await supabase.storage
          .from(BUCKET)
          .remove([previousPath]);

        if (deleteError) {
          console.error('Old picture cleanup failed:', deleteError.message);
        }
      }

      setMessage('Profile picture updated successfully.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not upload your picture.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!avatarPath || !userId) return;

    setRemoving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        throw new Error(
          error?.message || 'Could not remove the picture from your profile.'
        );
      }

      const oldPath = avatarPath;
      setAvatarPath('');
      setAvatarPreview('');

      const { error: deleteError } = await supabase.storage
        .from(BUCKET)
        .remove([oldPath]);

      if (deleteError) {
        console.error('Picture cleanup failed:', deleteError.message);
        setMessage(
          'Picture removed from your profile. An old storage file could not be deleted.'
        );
      } else {
        setMessage('Profile picture removed.');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not remove your picture.'
      );
    } finally {
      setRemoving(false);
    }
  }

  const busy = loading || saving || uploading || removing;

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
        <section className="mx-auto mb-6 max-w-xl rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Privacy</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Leaderboard identity</h2>
          <p className="mt-1 text-sm text-zinc-400">Opt out of public identity display without losing XP, quests, badges, or access to learning features.</p>
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-zinc-200">
            <input type="checkbox" checked={leaderboardAnonymous} disabled={savingPrivacy || loading} onChange={(event) => void handlePrivacyChange(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
            Show me as “Anonymous learner” on leaderboards
            {savingPrivacy && <span className="text-xs text-zinc-500">Saving…</span>}
          </label>
        </section>
        <section className="mx-auto max-w-xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
            ACCOUNT SETTINGS
          </p>

          <h1 className="mt-3 text-3xl font-bold">Your Profile</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Manage your LearnQuest username and profile picture.
          </p>

          <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <h2 className="text-lg font-semibold">Profile Picture</h2>

            <p className="mt-1 text-sm text-zinc-400">
              JPG, PNG, or WebP. Maximum size: 2 MB.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-5">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-500 bg-zinc-800 text-3xl font-bold text-emerald-400">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Your profile picture"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (username.trim()[0] || '?').toUpperCase()
                )}
              </div>

              <div className="flex flex-col items-start gap-3">
                <label className={`cursor-pointer rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                  {uploading ? 'Uploading…' : 'Upload Picture'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={busy}
                    onChange={handleUpload}
                  />
                </label>

                {avatarPath && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={busy}
                    className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    {removing ? 'Removing…' : 'Remove Picture'}
                  </button>
                )}
              </div>
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              Your picture is stored in your private account folder.
            </p>
          </section>

          <form
            onSubmit={handleSave}
            className="mt-5 space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6"
          >
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium text-zinc-200"
              >
                Username
              </label>

              <input
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                maxLength={24}
                required
                disabled={busy}
                autoComplete="nickname"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:opacity-50"
                placeholder="Enter a username"
              />

              <p className="mt-2 text-xs text-zinc-500">
                3–24 characters: letters, numbers, underscores, or hyphens.
              </p>
            </div>

            {errorMessage && (
              <p role="alert" className="break-words text-sm text-red-400">
                {errorMessage}
              </p>
            )}

            {message && (
              <p role="status" className="text-sm text-emerald-400">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? 'Loading profile…'
                : saving
                  ? 'Saving…'
                  : 'Save Changes'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-5 text-sm text-zinc-400 hover:text-white"
          >
            ← Back to dashboard
          </button>
        </section>
      </main>
    </>
  );
}

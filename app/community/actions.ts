'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function currentContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  const { data: profile } = await supabase
    .from('profiles').select('id, role, campus_id').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/dashboard');
  return { supabase, user, profile };
}

export async function createClub(formData: FormData) {
  const { supabase, user, profile } = await currentContext();
  if (!['campus_admin', 'super_admin'].includes(profile.role)) redirect('/community?error=forbidden');
  const campusId = profile.role === 'super_admin' ? String(formData.get('campus_id') ?? '') : profile.campus_id;
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? 'Community').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!campusId || name.length < 2 || name.length > 80 || category.length > 40 || description.length > 1200) {
    redirect('/community?error=invalid-club');
  }
  const { error } = await supabase.from('clubs').insert({ campus_id: campusId, name, category: category || 'Community', description, created_by: user.id });
  if (error) redirect(`/community?error=${encodeURIComponent(error.code === '23505' ? 'duplicate-club' : 'save-failed')}`);
  revalidatePath('/community');
  redirect('/community?success=club');
}

export async function createEvent(formData: FormData) {
  const { supabase, user, profile } = await currentContext();
  if (!['campus_admin', 'super_admin', 'teacher'].includes(profile.role)) redirect('/community?error=forbidden');
  const campusId = profile.role === 'super_admin' ? String(formData.get('campus_id') ?? '') : profile.campus_id;
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim();
  const startsAt = String(formData.get('starts_at') ?? '');
  const clubValue = String(formData.get('club_id') ?? '');
  const startsDate = new Date(startsAt);
  if (!campusId || title.length < 3 || title.length > 100 || location.length < 2 || location.length > 120 || description.length > 1600 || !startsAt || Number.isNaN(startsDate.getTime()) || startsDate <= new Date()) {
    redirect('/community?error=invalid-event');
  }
  const { error } = await supabase.from('campus_events').insert({
    campus_id: campusId, club_id: clubValue || null, title, description,
    location, starts_at: startsDate.toISOString(), created_by: user.id,
  });
  if (error) redirect(`/community?error=${encodeURIComponent(error.code === '23503' ? 'invalid-club' : 'save-failed')}`);
  revalidatePath('/community');
  redirect('/community?success=event');
}

export async function joinClub(formData: FormData) {
  const { supabase, user, profile } = await currentContext();
  if (profile.role !== 'student') redirect('/community?error=forbidden');
  const clubId = String(formData.get('club_id') ?? '');
  const { error } = await supabase.from('club_members').insert({ club_id: clubId, user_id: user.id });
  if (error && error.code !== '23505') redirect('/community?error=join-failed');
  revalidatePath('/community');
  redirect('/community?success=joined');
}

export async function leaveClub(formData: FormData) {
  const { supabase, user, profile } = await currentContext();
  if (profile.role !== 'student') redirect('/community?error=forbidden');
  const { error } = await supabase.from('club_members').delete().eq('club_id', String(formData.get('club_id') ?? '')).eq('user_id', user.id);
  if (error) redirect('/community?error=save-failed');
  revalidatePath('/community');
  redirect('/community?success=left');
}

export async function registerEvent(formData: FormData) {
  const { supabase, user, profile } = await currentContext();
  if (profile.role !== 'student') redirect('/community?error=forbidden');
  const { error } = await supabase.from('event_registrations').insert({ event_id: String(formData.get('event_id') ?? ''), user_id: user.id });
  if (error && error.code !== '23505') redirect('/community?error=register-failed');
  revalidatePath('/community');
  redirect('/community?success=registered');
}

export async function cancelEventRegistration(formData: FormData) {
  const { supabase, user, profile } = await currentContext();
  if (profile.role !== 'student') redirect('/community?error=forbidden');
  const { error } = await supabase.from('event_registrations').delete().eq('event_id', String(formData.get('event_id') ?? '')).eq('user_id', user.id);
  if (error) redirect('/community?error=save-failed');
  revalidatePath('/community');
  redirect('/community?success=cancelled');
}

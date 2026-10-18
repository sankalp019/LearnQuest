import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AppRole =
  | 'student'
  | 'teacher'
  | 'campus_admin'
  | 'super_admin';

export async function requireRole(allowedRoles: AppRole[]) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/auth');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, role, campus_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect('/dashboard');
  }

  const role = profile.role as AppRole;

  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  return { supabase, user, profile };
}

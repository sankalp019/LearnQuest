import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Super admin access required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId ?? '');
  const role = String(body.role ?? '');
  const reason = String(body.reason ?? '').trim().slice(0, 500);
  if (!userId || !['student','teacher','campus_admin','super_admin'].includes(role)) return NextResponse.json({ error: 'Choose a valid account and role.' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'A reason is required for the audit log.' }, { status: 400 });
  const { data, error } = await supabase.rpc('admin_set_profile_role', { p_user_id: userId, p_role: role, p_reason: reason });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ result: data });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Super admin access required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const code = String(body.code ?? '').trim().toUpperCase();
  if (name.length < 2 || name.length > 120 || code.length < 2 || code.length > 20 || !/^[A-Z0-9_-]+$/.test(code)) {
    return NextResponse.json({ error: 'Enter a campus name and a 2–20 character code (letters, numbers, - or _).' }, { status: 400 });
  }
  const { data, error } = await supabase.from('campuses').insert({ name, code }).select('id,name,code,created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from('admin_audit_log').insert({ actor_id: user.id, action: 'campus.created', target_type: 'campus', target_id: data.id, reason: 'Created from Super Admin dashboard', metadata: { name, code } });
  return NextResponse.json({ campus: data });
}

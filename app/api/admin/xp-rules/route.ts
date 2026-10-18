import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function staffContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return { supabase, user, role: profile?.role ?? null };
}

export async function GET() {
  const { supabase, user, role } = await staffContext();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!['teacher', 'campus_admin', 'super_admin'].includes(role ?? '')) return NextResponse.json({ error: 'Staff access required.' }, { status: 403 });
  const { data, error } = await supabase.from('xp_rules').select('*').order('label');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function PATCH(request: Request) {
  const { supabase, user, role } = await staffContext();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!['campus_admin', 'super_admin'].includes(role ?? '')) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '');
  const points = Number(body.points);
  const dailyLimit = body.daily_limit === '' || body.daily_limit == null ? null : Number(body.daily_limit);
  const enabled = Boolean(body.enabled);
  if (!id || !Number.isInteger(points) || points < 0 || points > 1000 || (dailyLimit !== null && (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000))) {
    return NextResponse.json({ error: 'Invalid XP rule values.' }, { status: 400 });
  }
  const { data, error } = await supabase.from('xp_rules').update({ points, daily_limit: dailyLimit, enabled, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from('admin_audit_log').insert({ actor_id: user.id, action: 'xp_rule.updated', target_type: 'xp_rule', target_id: id, reason: 'Updated XP economy settings', metadata: { points, daily_limit: dailyLimit, enabled } });
  return NextResponse.json({ rule: data });
}

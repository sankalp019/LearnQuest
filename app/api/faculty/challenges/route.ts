import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!['teacher','campus_admin','super_admin'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Faculty or admin access required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.questions)) return NextResponse.json({ error: 'Questions must be a JSON array.' }, { status: 400 });
  const { data, error } = await supabase.rpc('faculty_create_challenge', {
    p_title: String(body.title ?? ''), p_description: String(body.description ?? ''),
    p_subject: String(body.subject ?? ''), p_difficulty: String(body.difficulty ?? 'Easy'),
    p_xp_reward: Number(body.xp_reward ?? 50), p_is_published: Boolean(body.is_published),
    p_questions: body.questions,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ result: data });
}

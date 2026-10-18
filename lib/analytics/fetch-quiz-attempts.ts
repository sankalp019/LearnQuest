import type { SupabaseClient } from '@supabase/supabase-js';

/** Fetches attempt history in pages so the participation matrix is not silently
 * limited to Supabase's default row cap. Caller must already be role-authorized;
 * database RLS remains the source of truth for which rows are visible. */
export async function fetchQuizAttempts(supabase: SupabaseClient) {
  const allRows: Array<{
    id: string;
    user_id: string;
    challenge_id: string;
    score: number | null;
    total_questions: number | null;
    xp_earned: number | null;
    completed_at: string | null;
  }> = [];
  const pageSize = 1000;
  const safetyCap = 100_000;

  for (let offset = 0; offset < safetyCap; offset += pageSize) {
    const { data, error } = await supabase
      .from('challenge_attempts')
      .select('id,user_id,challenge_id,score,total_questions,xp_earned,completed_at')
      .order('completed_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    allRows.push(...page);
    if (page.length < pageSize) return { data: allRows, error: null };
  }

  return { data: allRows, error: null };
}

export async function fetchQuizReportStudents(supabase: SupabaseClient, campusId?: string | null) {
  const allRows: Array<{
    id: string;
    username: string | null;
    campus_id: string | null;
    xp: number | null;
    level: number | null;
    role: string | null;
    streak: number | null;
    last_activity_date: string | null;
    created_at: string;
  }> = [];
  const pageSize = 1000;
  const safetyCap = 100_000;

  for (let offset = 0; offset < safetyCap; offset += pageSize) {
    let query = supabase
      .from('profiles')
      .select('id,username,campus_id,xp,level,role,streak,last_activity_date,created_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    if (campusId) query = query.eq('campus_id', campusId);
    else if (campusId === null) query = query.eq('campus_id', '00000000-0000-0000-0000-000000000000');
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    allRows.push(...page);
    if (page.length < pageSize) return { data: allRows, error: null };
  }
  return { data: allRows, error: null };
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await context.params;

    // 1. Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!challengeId || !uuidRegex.test(challengeId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid challenge ID format.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 2. Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required to review challenge.' },
        { status: 401 }
      );
    }

    // 3. Verify user has actually completed this challenge before revealing review data
    const { data: attempt, error: attemptError } = await supabase
      .from('challenge_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('challenge_id', challengeId)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { ok: false, error: 'No completed attempt found for this challenge.' },
        { status: 404 }
      );
    }

    // 4. Securely retrieve review data server-side strictly via read-only get_quiz_review RPC
    // Do NOT fall back to submit_quiz to guarantee no attempts, XP, or profile data can ever be mutated during review.
    const { data: reviewData, error: rpcError } = await supabase.rpc('get_quiz_review', {
      p_challenge_id: challengeId,
    });

    if (rpcError || !reviewData) {
      return NextResponse.json(
        {
          ok: false,
          error:
            rpcError?.message ||
            'Failed to load quiz review. Please ensure the latest database migration has been executed in Supabase.',
        },
        { status: 500 }
      );
    }

    if (typeof reviewData === 'object' && reviewData !== null && 'ok' in reviewData && !reviewData.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: (reviewData as { error?: string }).error || 'Failed to retrieve quiz review.',
        },
        { status: 500 }
      );
    }

    const reviewPayload = reviewData as Record<string, unknown>;

    // 5. Return review payload with original earned XP and exact attempt options snapshot
    return NextResponse.json({
      ...reviewPayload,
      xpEarned: attempt.xp_earned,
      optionsSnapshot: attempt.options_snapshot || reviewPayload.optionsSnapshot || null,
      alreadyCompleted: true,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status: 500 }
    );
  }
}

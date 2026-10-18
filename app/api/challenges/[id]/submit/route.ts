import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await context.params;

    // Validate UUID format for challengeId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!challengeId || !uuidRegex.test(challengeId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid challenge ID format.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required. Please log in to submit your quiz.' },
        { status: 401 }
      );
    }

    // 2. Parse and sanitize submitted student answers & options snapshot
    const body = await request.json().catch(() => ({}));
    const sanitizedAnswers: Record<string, string> = {};
    const sanitizedOptionsSnapshot: Record<string, string[]> = {};

    if (
      body &&
      typeof body === 'object' &&
      body.answers &&
      typeof body.answers === 'object' &&
      !Array.isArray(body.answers)
    ) {
      for (const [key, val] of Object.entries(body.answers)) {
        if (typeof key === 'string' && val !== undefined && val !== null) {
          sanitizedAnswers[key] = String(val).trim();
        }
      }
    }

    if (
      body &&
      typeof body === 'object' &&
      body.optionsSnapshot &&
      typeof body.optionsSnapshot === 'object' &&
      !Array.isArray(body.optionsSnapshot)
    ) {
      for (const [key, val] of Object.entries(body.optionsSnapshot)) {
        if (typeof key === 'string' && Array.isArray(val)) {
          sanitizedOptionsSnapshot[key] = val.map(String);
        }
      }
    }

    const hasSnapshot = Object.keys(sanitizedOptionsSnapshot).length > 0;

    // 3. Invoke secure server-side scoring function
    // Answer keys are isolated in `quiz_answer_keys` and never exposed to the client.
    // The SECURITY DEFINER function atomically scores, checks duplicates, and attributes XP.
    let rpcCall = await supabase.rpc('submit_quiz', {
      p_challenge_id: challengeId,
      p_answers: sanitizedAnswers,
      p_options_snapshot: hasSnapshot ? sanitizedOptionsSnapshot : null,
    });

    // Graceful fallback if live DB has not yet applied the 3-parameter overload
    if (rpcCall.error && rpcCall.error.message.includes('p_options_snapshot')) {
      rpcCall = await supabase.rpc('submit_quiz', {
        p_challenge_id: challengeId,
        p_answers: sanitizedAnswers,
      });
    }

    const { data: result, error: rpcError } = rpcCall;

    if (rpcError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            rpcError.message ||
            'Failed to score quiz. Please ensure migrations have been executed in Supabase.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status: 500 }
    );
  }
}

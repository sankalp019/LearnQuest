import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // getUser() verifies Supabase connectivity server-side via a real auth round-trip.
    // An unauthenticated response is expected and is not treated as an error.
    const { error } = await supabase.auth.getUser();

    if (error && error.message !== "Auth session missing!") {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      supabase: "connected",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Supabase connection failed";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
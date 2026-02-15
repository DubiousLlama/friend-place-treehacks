import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/onboarding/count
 * Returns how many times the current (linked) user has seen onboarding popups.
 * Only called when user is linked; anonymous users use localStorage.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: player } = await supabase
    .from("players")
    .select("onboarding_plays_seen")
    .eq("id", user.id)
    .maybeSingle();

  const count = player?.onboarding_plays_seen ?? 0;
  return NextResponse.json({ count });
}

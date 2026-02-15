import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/seen
 * Increments the current (linked) user's onboarding_plays_seen (capped at 2).
 * Only called when user is linked; anonymous users use localStorage.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch current value, then set to min(current + 1, 2)
  const { data: player } = await supabase
    .from("players")
    .select("onboarding_plays_seen")
    .eq("id", user.id)
    .maybeSingle();

  const current = player?.onboarding_plays_seen ?? 0;
  const nextCount = Math.min(current + 1, 2);

  const { error: updateError } = await supabase
    .from("players")
    .update({ onboarding_plays_seen: nextCount })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update" },
      { status: 500 }
    );
  }

  return NextResponse.json({ count: nextCount });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET: returns a suggested display name for the current user:
 * - latest game_players.display_name where player_id = current user (from recent gameplay)
 * Used by set-name page for prefilling when user has no players.display_name yet.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row } = await supabase
    .from("game_players")
    .select("display_name")
    .eq("player_id", user.id)
    .not("display_name", "is", null)
    .order("claimed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const suggestedDisplayName =
    row?.display_name && String(row.display_name).trim() ? String(row.display_name).trim() : null;
  return NextResponse.json({ suggestedDisplayName });
}

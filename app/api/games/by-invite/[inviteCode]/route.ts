import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/games/by-invite/[inviteCode]
 *
 * Returns whether the invite code corresponds to no game, a deleted game, or an active game.
 * Used so the play page can show "This game has been deleted" vs "Game not found".
 * Uses RPC check_game_invite_status (SECURITY DEFINER) so we don't need service role.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await params;

  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("check_game_invite_status", {
    p_invite_code: inviteCode,
  });

  if (error || status == null) {
    return NextResponse.json({ status: "not_found" as const }, { status: 200 });
  }
  const s = String(status);
  if (s !== "deleted" && s !== "active") {
    return NextResponse.json({ status: "not_found" as const }, { status: 200 });
  }
  return NextResponse.json({ status: s as "deleted" | "active" }, { status: 200 });
}

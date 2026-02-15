import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskEmail } from "@/lib/utils";

export type GameInviteItem = { id: string; masked_email: string; invited_by: string; expires_at: string };

/**
 * GET list of pending email invites for a game (masked email).
 * Caller must be game creator or a game player.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id, created_by")
    .eq("id", gameId)
    .single();
  if (gameErr || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  const isCreator = game.created_by === user.id;
  const { data: mySlot } = await supabase
    .from("game_players")
    .select("id")
    .eq("game_id", gameId)
    .eq("player_id", user.id)
    .maybeSingle();
  if (!isCreator && !mySlot) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: invites, error: inviteErr } = await admin
    .from("email_invites")
    .select("id, email, invited_by, expires_at")
    .eq("target_type", "game")
    .eq("target_id", gameId);

  if (inviteErr) {
    return NextResponse.json({ error: "Failed to load invites" }, { status: 500 });
  }

  const items: GameInviteItem[] = (invites ?? []).map((inv) => ({
    id: inv.id,
    masked_email: maskEmail(inv.email),
    invited_by: inv.invited_by,
    expires_at: inv.expires_at,
  }));

  return NextResponse.json({ invites: items });
}

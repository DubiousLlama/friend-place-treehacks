import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/games/[id]
 *
 * Soft-deletes the game: sets deleted_at so the game is hidden from profile
 * and all listings. Only the game creator (host) can do this.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: game, error: fetchError } = await supabase
    .from("games")
    .select("id, created_by")
    .eq("id", gameId)
    .single();

  if (fetchError || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.created_by !== user.id) {
    return NextResponse.json({ error: "Only the host can delete this game" }, { status: 403 });
  }

  // RPC runs as SECURITY DEFINER so the UPDATE is not subject to RLS (avoids "new row violates" when JWT not applied to client update)
  const { error } = await supabase.rpc("soft_delete_game", { p_game_id: gameId });

  if (error) {
    if (error.message?.includes("Only the host")) {
      return NextResponse.json({ error: "Only the host can delete this game" }, { status: 403 });
    }
    if (error.message?.includes("not found")) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

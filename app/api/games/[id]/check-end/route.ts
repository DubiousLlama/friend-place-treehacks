import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/games/[id]/check-end
 *
 * Legacy endpoint — now delegates to the check_and_end_game RPC.
 * Kept for backwards compatibility but no longer required;
 * clients call the RPC directly.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;

  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    // No body or invalid JSON — not forced
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_and_end_game", {
    p_game_id: gameId,
    p_force: force,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

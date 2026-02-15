import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Merge anonymous user's data into the current (logged-in) user.
 * Called when user signs in with email/OAuth on a device that had anonymous play.
 * Body: { fromUserId: string } — the anonymous auth.uid() to merge from.
 * Requires: current user must be authenticated and have a persistent identity (not anonymous).
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabaseAuth = await createServerClient();
  const {
    data: { user: currentUser },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fromUserId = typeof body.fromUserId === "string" ? body.fromUserId.trim() : null;
  if (!fromUserId) {
    return NextResponse.json(
      { error: "Missing fromUserId" },
      { status: 400 }
    );
  }

  // Validate UUID format (Supabase auth.uid() format)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(fromUserId)) {
    return NextResponse.json(
      { error: "Invalid fromUserId" },
      { status: 400 }
    );
  }

  // Don't allow merging into yourself
  if (fromUserId === currentUser.id) {
    return NextResponse.json({ merged: true });
  }

  // Only allow merge if current user has a persistent identity (not anonymous)
  const isAnonymous =
    currentUser.is_anonymous === true ||
    (currentUser.app_metadata?.provider === "anonymous");
  if (isAnonymous) {
    return NextResponse.json(
      { error: "Sign in with email or Google first" },
      { status: 403 }
    );
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Only allow merging from an anonymous identity (prevents stealing another user's data)
  const { data: fromUser, error: fromUserError } = await admin.auth.admin.getUserById(fromUserId);
  if (fromUserError || !fromUser?.user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }
  if (!fromUser.user.is_anonymous) {
    return NextResponse.json(
      { error: "Can only merge anonymous session data" },
      { status: 403 }
    );
  }

  // Reassign games created by fromUserId to current user
  const { error: gamesError } = await admin
    .from("games")
    .update({ created_by: currentUser.id })
    .eq("created_by", fromUserId);

  if (gamesError) {
    return NextResponse.json(
      { error: "Failed to merge games" },
      { status: 500 }
    );
  }

  // Reassign game_players where player_id was the anonymous user
  const { error: gpError } = await admin
    .from("game_players")
    .update({ player_id: currentUser.id })
    .eq("player_id", fromUserId);

  if (gpError) {
    return NextResponse.json(
      { error: "Failed to merge game players" },
      { status: 500 }
    );
  }

  // Optionally copy display_name from anonymous player to current if current has none
  const { data: fromPlayer } = await admin
    .from("players")
    .select("display_name")
    .eq("id", fromUserId)
    .single();

  const { data: toPlayer } = await admin
    .from("players")
    .select("display_name")
    .eq("id", currentUser.id)
    .single();

  let suggestedDisplayName: string | undefined;
  if (fromPlayer?.display_name && !toPlayer?.display_name) {
    await admin
      .from("players")
      .update({ display_name: fromPlayer.display_name })
      .eq("id", currentUser.id);
    suggestedDisplayName = fromPlayer.display_name;
  }

  // Remove the anonymous player row so it doesn't linger (no FKs point to it now)
  await admin.from("players").delete().eq("id", fromUserId);

  // Mark the current account as linked
  await admin
    .from("players")
    .update({ linked_at: new Date().toISOString() })
    .eq("id", currentUser.id);

  return NextResponse.json({ merged: true, ...(suggestedDisplayName && { suggestedDisplayName }) });
}

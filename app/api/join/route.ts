import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Accept an email invite (group or game).
 * Body: { token, displayName? }. displayName is used for game invites when claiming the reserved slot.
 * Requires authenticated user. For group invites, user email must match invite email; for games, anyone can claim.
 * Returns { redirect: string } or error.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Sign in to accept this invite" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invite, error: inviteErr } = await admin
    .from("email_invites")
    .select("id, target_type, target_id, email, invited_by, expires_at")
    .eq("token", token)
    .single();
  if (inviteErr || !invite) {
    return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
  }
  const now = new Date().toISOString();
  if (invite.expires_at && invite.expires_at < now) {
    await admin.from("email_invites").delete().eq("id", invite.id);
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  if (invite.target_type === "group") {
    const userEmail = user.email?.toLowerCase() ?? "";
    const inviteEmail = invite.email.toLowerCase();
    if (userEmail !== inviteEmail) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address" },
        { status: 403 }
      );
    }
  }

  const { data: player } = await admin
    .from("players")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const defaultDisplayName = player?.display_name?.trim() || "Member";

  if (invite.target_type === "group") {
    const { data: existing } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", invite.target_id)
      .eq("player_id", user.id)
      .maybeSingle();
    if (existing) {
      await admin.from("email_invites").delete().eq("id", invite.id);
      return NextResponse.json({ redirect: `/groups/${invite.target_id}` });
    }
    const { data: maxOrder } = await admin
      .from("group_members")
      .select("sort_order")
      .eq("group_id", invite.target_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (maxOrder?.sort_order ?? -1) + 1;
    await admin.from("players").upsert(
      { id: user.id, display_name: defaultDisplayName || "Member" },
      { onConflict: "id" }
    );
    const { error: insertErr } = await admin.from("group_members").insert({
      group_id: invite.target_id,
      player_id: user.id,
      is_anonymous: false,
      sort_order: sortOrder,
    });
    if (insertErr) {
      return NextResponse.json(
        { error: "Could not add you to the group" },
        { status: 500 }
      );
    }
    await admin.from("email_invites").delete().eq("id", invite.id);
    return NextResponse.json({ redirect: `/groups/${invite.target_id}` });
  }

  if (invite.target_type === "game") {
    const { data: game } = await admin
      .from("games")
      .select("id, invite_code")
      .eq("id", invite.target_id)
      .single();
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    const { data: existingSlot } = await admin
      .from("game_players")
      .select("id")
      .eq("game_id", invite.target_id)
      .eq("player_id", user.id)
      .maybeSingle();
    if (existingSlot) {
      await admin.from("email_invites").delete().eq("id", invite.id);
      return NextResponse.json({ redirect: `/play/${game.invite_code}` });
    }
    const displayName =
      (typeof body.displayName === "string" ? body.displayName.trim() : null) ||
      defaultDisplayName ||
      "Member";
    await admin.from("players").upsert(
      { id: user.id, display_name: displayName },
      { onConflict: "id" }
    );
    const inviteEmail = invite.email.toLowerCase();
    const { data: reservedSlot } = await admin
      .from("game_players")
      .select("id")
      .eq("game_id", invite.target_id)
      .is("player_id", null)
      .eq("invited_email", inviteEmail)
      .maybeSingle();
    if (reservedSlot) {
      const { error: updateErr } = await admin
        .from("game_players")
        .update({
          player_id: user.id,
          display_name: displayName,
          claimed_at: new Date().toISOString(),
          invited_email: null,
        })
        .eq("id", reservedSlot.id);
      if (updateErr) {
        return NextResponse.json(
          { error: "Could not add you to the game" },
          { status: 500 }
        );
      }
    } else {
      const { error: slotErr } = await admin.from("game_players").insert({
        game_id: invite.target_id,
        player_id: user.id,
        display_name: displayName,
        claimed_at: new Date().toISOString(),
      });
      if (slotErr) {
        return NextResponse.json(
          { error: "Could not add you to the game" },
          { status: 500 }
        );
      }
    }
    await admin.from("email_invites").delete().eq("id", invite.id);
    return NextResponse.json({ redirect: `/play/${game.invite_code}` });
  }

  return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
}

/**
 * Resolve an invite token (read-only). Used to redirect game invites to the play page.
 * GET /api/join?token=xyz → { target_type: "game" | "group", invite_code?: string } or 404.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: invite, error: inviteErr } = await admin
    .from("email_invites")
    .select("target_type, target_id, expires_at, suggested_display_name")
    .eq("token", token)
    .single();
  if (inviteErr || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  const now = new Date().toISOString();
  if (invite.expires_at && invite.expires_at < now) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }
  if (invite.target_type === "game") {
    const { data: game } = await admin
      .from("games")
      .select("invite_code")
      .eq("id", invite.target_id)
      .single();
    if (game?.invite_code) {
      return NextResponse.json({
        target_type: "game" as const,
        invite_code: game.invite_code,
        suggested_display_name: invite.suggested_display_name ?? undefined,
      });
    }
  }
  return NextResponse.json({ target_type: invite.target_type });
}

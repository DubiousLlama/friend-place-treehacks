import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupUserByEmail } from "@/lib/user-lookup";
import { generateInviteToken } from "@/lib/utils";
import { sendInviteEmail } from "@/lib/email";
import { maskEmail } from "@/lib/utils";
import {
  getDeviceKey,
  getOrCreateDailyUsage,
  incrementInviteEmailsSent,
} from "@/lib/device-usage";

const DAILY_INVITE_EMAIL_LIMIT = 20;

const INVITE_EXPIRY_DAYS = 7;

/**
 * Invite someone to a group by email.
 * If they have an account: add to group_members with their player_id (display name comes from players table).
 * If not: create email_invites row and send join link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const emailLower = email.toLowerCase();

  const { data: group, error: groupErr } = await supabase
    .from("saved_groups")
    .select("id, name, owner_id, anyone_can_add_members")
    .eq("id", groupId)
    .single();
  if (groupErr || !group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const isOwner = group.owner_id === user.id;
  const { data: myMember } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("player_id", user.id)
    .maybeSingle();
  const canAdd = isOwner || (group.anyone_can_add_members && myMember);
  if (!canAdd) {
    return NextResponse.json({ error: "You cannot add members to this group" }, { status: 403 });
  }

  const lookup = await lookupUserByEmail(email).catch((err) => {
    console.error("[invite-by-email] lookup error:", err);
    return { found: false as const };
  });

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "app/api/groups/[id]/invite-by-email/route.ts",
      message: "group invite lookup result",
      data: { email: emailLower, found: lookup.found, playerId: "playerId" in lookup ? lookup.playerId ?? null : null },
      timestamp: Date.now(),
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion

  if (lookup.found && lookup.playerId) {
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("player_id", lookup.playerId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "That person is already in the group" },
        { status: 409 }
      );
    }
    const admin = createAdminClient();
    await admin.from("players").upsert(
      { id: lookup.playerId, display_name: lookup.displayName ?? "Member" },
      { onConflict: "id" }
    );
    const { data: maxOrder } = await supabase
      .from("group_members")
      .select("sort_order")
      .eq("group_id", groupId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (maxOrder?.sort_order ?? -1) + 1;
    const { error: insertErr } = await supabase.from("group_members").insert({
      group_id: groupId,
      player_id: lookup.playerId,
      is_anonymous: false,
      sort_order: sortOrder,
    });
    if (insertErr) {
      return NextResponse.json(
        { error: insertErr.message ?? "Failed to add member" },
        { status: 500 }
      );
    }
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "app/api/groups/[id]/invite-by-email/route.ts",
        message: "group invite added existing user (no email)",
        data: { email: emailLower },
        timestamp: Date.now(),
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ added: true });
  }

  const deviceKey = getDeviceKey(request);
  const usage = await getOrCreateDailyUsage(deviceKey, request);
  if (usage.invite_count + 1 > DAILY_INVITE_EMAIL_LIMIT) {
    return NextResponse.json(
      { error: "Daily limit of 20 invite emails reached. Resets at midnight UTC." },
      { status: 429 }
    );
  }

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("email_invites")
    .select("id")
    .eq("target_type", "group")
    .eq("target_id", groupId)
    .ilike("email", emailLower)
    .maybeSingle();
  if (pending) {
    return NextResponse.json(
      { error: "An invite has already been sent to that email" },
      { status: 409 }
    );
  }

  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
  const { error: inviteErr } = await admin.from("email_invites").insert({
    target_type: "group",
    target_id: groupId,
    email: emailLower,
    token,
    invited_by: user.id,
    expires_at: expiresAt.toISOString(),
  });
  if (inviteErr) {
    if (inviteErr.code === "23505") {
      return NextResponse.json(
        { error: "An invite has already been sent to that email" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: inviteErr.message ?? "Failed to create invite" },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const joinUrl = `${baseUrl}/join?token=${encodeURIComponent(token)}`;
  const groupName = group.name?.trim() || undefined;
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "app/api/groups/[id]/invite-by-email/route.ts",
      message: "group invite calling sendInviteEmail",
      data: { email, groupName },
      timestamp: Date.now(),
      hypothesisId: "D",
    }),
  }).catch(() => {});
  // #endregion
  await sendInviteEmail({
    to: email,
    type: "group",
    groupName,
    joinUrl,
  });

  await incrementInviteEmailsSent(deviceKey, 1);

  return NextResponse.json({ invited: true, email: maskEmail(emailLower) });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteToken } from "@/lib/utils";
import { sendInviteEmail } from "@/lib/email";
import {
  getDeviceKey,
  getOrCreateDailyUsage,
  incrementInviteEmailsSent,
} from "@/lib/device-usage";

const DAILY_INVITE_EMAIL_LIMIT = 20;

const INVITE_EXPIRY_DAYS = 7;

/**
 * Create email invites for a game (after game creation).
 * Body: { invites: { email: string, displayName?: string }[] } or { emails: string[] }.
 * Only the game creator can call. Sends invite email to each address.
 */
export async function POST(
  request: NextRequest,
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

  const body = await request.json().catch(() => ({}));
  let invites: { email: string; displayName?: string }[] = [];
  if (Array.isArray(body.invites)) {
    invites = body.invites
      .map((item: { email?: unknown; displayName?: unknown }) => {
        const email = typeof item?.email === "string" ? item.email.trim().toLowerCase() : "";
        if (!email || !email.includes("@")) return null;
        const displayName = typeof item?.displayName === "string" ? item.displayName.trim() || undefined : undefined;
        return { email, displayName };
      })
      .filter((x: { email: string; displayName?: string } | null): x is { email: string; displayName?: string } => x !== null);
    const seen = new Set<string>();
    invites = invites.filter((x) => {
      if (seen.has(x.email)) return false;
      seen.add(x.email);
      return true;
    });
  } else {
    const rawEmails: unknown[] = Array.isArray(body.emails) ? body.emails : [];
    const normalized = rawEmails
      .map((e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter((e): e is string => !!e && e.includes("@"));
    invites = [...new Set(normalized)].map((email) => ({ email }));
  }
  if (invites.length === 0) {
    return NextResponse.json({ invited: 0, message: "No valid emails" });
  }

  const deviceKey = getDeviceKey(request);
  const usage = await getOrCreateDailyUsage(deviceKey, request);
  if (usage.invite_count + invites.length > DAILY_INVITE_EMAIL_LIMIT) {
    return NextResponse.json(
      { error: "Daily limit of 20 invite emails reached. Resets at midnight UTC." },
      { status: 429 }
    );
  }

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "app/api/games/[id]/invite-by-email/route.ts",
      message: "game invite-by-email entry",
      data: { gameId, invites },
      timestamp: Date.now(),
      hypothesisId: "D",
    }),
  }).catch(() => {});
  // #endregion

  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id, invite_code, created_by")
    .eq("id", gameId)
    .single();
  if (gameErr || !game || game.created_by !== user.id) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
  const admin = createAdminClient();
  let created = 0;
  for (const { email, displayName: suggestedDisplayName } of invites) {
    const { data: existing } = await admin
      .from("email_invites")
      .select("id")
      .eq("target_type", "game")
      .eq("target_id", gameId)
      .ilike("email", email)
      .maybeSingle();
    // #region agent log
    if (existing) {
      fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "app/api/games/[id]/invite-by-email/route.ts",
          message: "game invite skip: existing row",
          data: { email, existingId: existing.id },
          timestamp: Date.now(),
          hypothesisId: "F",
        }),
      }).catch(() => {});
    }
    // #endregion
    if (existing) continue;

    const token = generateInviteToken();
    const { error: insertErr } = await admin.from("email_invites").insert({
      target_type: "game",
      target_id: gameId,
      email,
      token,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
      suggested_display_name: suggestedDisplayName || null,
    });
    // #region agent log
    if (insertErr) {
      fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "app/api/games/[id]/invite-by-email/route.ts",
          message: "game invite insert error",
          data: { email, code: insertErr.code, message: insertErr.message },
          timestamp: Date.now(),
          hypothesisId: "F",
        }),
      }).catch(() => {});
    }
    // #endregion
    if (insertErr) {
      if (insertErr.code === "23505") continue;
      const message =
        insertErr.code === "PGRST205"
          ? "Email invites are not set up. Run database migrations (e.g. supabase db push)."
          : insertErr.code === "42P17"
            ? "Database policy error (recursion). Run migration 20260216190000_fix_group_members_rls_recursion."
            : insertErr.message ?? "Failed to create invite";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    const slotDisplayName = suggestedDisplayName?.trim() || email;
    const { error: slotErr } = await admin.from("game_players").insert({
      game_id: gameId,
      player_id: null,
      display_name: slotDisplayName,
      claimed_at: null,
      invited_email: email,
    });
    if (slotErr) {
      return NextResponse.json(
        { error: slotErr.message ?? "Failed to reserve slot" },
        { status: 500 }
      );
    }
    const playUrl = `${baseUrl}/play/${game.invite_code}?claim=${encodeURIComponent(token)}`;
    await sendInviteEmail({
      to: email,
      type: "game",
      inviteCode: game.invite_code,
      joinUrl: playUrl,
    });
    created += 1;
  }
  if (created > 0) {
    await incrementInviteEmailsSent(deviceKey, created);
  }
  return NextResponse.json({ invited: created });
}

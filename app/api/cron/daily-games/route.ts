import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteCode } from "@/lib/utils";

/**
 * GET /api/cron/daily-games
 *
 * Vercel Cron: run daily. For each group with daily_game_enabled = true,
 * creates today's game (using daily axes) and game_players from group_members.
 * Optionally sends reminder emails to members (stub: log only; wire Resend/Supabase later).
 *
 * Secure: require CRON_SECRET in env and Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const lockAt = tomorrow.toISOString();

  try {
    const supabase = createAdminClient();

    const { data: groups, error: groupsErr } = await supabase
      .from("saved_groups")
      .select("id, owner_id, name")
      .eq("daily_game_enabled", true);

    if (groupsErr || !groups?.length) {
      return NextResponse.json({ created: 0, message: groupsErr?.message ?? "No groups with daily games" });
    }

    const dailyRes = await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3000"}/api/ai/daily-axis`);
    const dailyAxes = await dailyRes.json();
    const xLow = dailyAxes.x_low ?? "Gimli";
    const xHigh = dailyAxes.x_high ?? "Legolas";
    const yLow = dailyAxes.y_low ?? "Muffin";
    const yHigh = dailyAxes.y_high ?? "Pancake";

    let created = 0;
    const emailsToSend: { email: string; groupName: string; inviteCode: string }[] = [];

    for (const group of groups) {
      const inviteCode = generateInviteCode();
      const { data: game, error: gameErr } = await supabase
        .from("games")
        .insert({
          invite_code: inviteCode,
          created_by: group.owner_id,
          phase: "placing",
          axis_x_label_low: xLow,
          axis_x_label_high: xHigh,
          axis_y_label_low: yLow,
          axis_y_label_high: yHigh,
          submissions_lock_at: lockAt,
          end_early_when_complete: true,
          group_id: group.id,
        })
        .select("id")
        .single();

      if (gameErr || !game) continue;

      const { data: members } = await supabase
        .from("group_members")
        .select("player_id, display_name")
        .eq("group_id", group.id)
        .order("sort_order", { ascending: true });

      const slots = (members ?? []).map((m, i) => ({
        game_id: game.id,
        player_id: m.player_id,
        display_name: m.display_name,
        claimed_at: null,
      }));

      const { error: slotsErr } = await supabase.from("game_players").insert(slots);
      if (slotsErr) continue;

      created += 1;
      const groupName = group.name?.trim() || "Your group";
      for (const m of members ?? []) {
        if (m.player_id) {
          const { data: user } = await supabase.auth.admin.getUserById(m.player_id);
          if (user?.user?.email) {
            emailsToSend.push({ email: user.user.email, groupName, inviteCode });
          }
        }
      }
    }

    if (emailsToSend.length > 0) {
      console.log("[daily-games] Would send reminder emails:", emailsToSend.length, emailsToSend.map((e) => e.email));
      // TODO: integrate Resend or Supabase email to send reminders with play link
    }

    return NextResponse.json({ created, today, emailsQueued: emailsToSend.length });
  } catch (err) {
    console.error("[daily-games] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

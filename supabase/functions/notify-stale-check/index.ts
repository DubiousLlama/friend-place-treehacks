import { supabaseAdmin } from "../_shared/supabase.ts";
import { getNotificationChannel, getChannelType } from "../_shared/notification-channel.ts";
import { getNotificationRecipient } from "../_shared/recipient.ts";
import { sendResultsRemindersForGame } from "../_shared/results-reminder.ts";
import {
  generateNotificationMessage,
  type GameContext,
} from "../_shared/ai.ts";

const MID_GAME_HOURS = 2;
const MID_GAME_PERCENT = 0.45;
const RESULTS_REMINDER_HOURS = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await runMidGameNudges();
    await runResultsReminders();
  } catch (e) {
    console.error("[notify-stale-check]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function runMidGameNudges(): Promise<void> {
  const cutoff = new Date(Date.now() - MID_GAME_HOURS * 60 * 60 * 1000).toISOString();
  const { data: games } = await supabaseAdmin
    .from("games")
    .select("id, invite_code, created_at, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
    .eq("phase", "placing")
    .lt("created_at", cutoff);
  if (!games?.length) return;

  const channelType = getChannelType();
  const channel = await getNotificationChannel();

  for (const game of games) {
    const { data: slots } = await supabaseAdmin
      .from("game_players")
      .select("id, player_id, display_name, has_submitted")
      .eq("game_id", game.id);
    if (!slots?.length) continue;

    const total = slots.length;
    const submitted = slots.filter((s) => s.has_submitted).length;
    if (submitted / total < MID_GAME_PERCENT) continue;

    const remaining = slots.filter((s) => !s.has_submitted && s.player_id);
    const context: GameContext = {
      axis_x_low: game.axis_x_label_low,
      axis_x_high: game.axis_x_label_high,
      axis_y_low: game.axis_y_label_low,
      axis_y_high: game.axis_y_label_high,
      submittedCount: submitted,
      totalCount: total,
      playerNames: slots.map((s) => s.display_name),
    };

    for (const slot of remaining) {
      const pid = slot.player_id!;
      const { data: existing } = await supabaseAdmin
        .from("notification_log")
        .select("id")
        .eq("player_id", pid)
        .eq("game_id", game.id)
        .eq("kind", "mid_game_nudge")
        .maybeSingle();
      if (existing) continue;

      const { data: player } = await supabaseAdmin
        .from("players")
        .select("id, phone, notifications_enabled")
        .eq("id", pid)
        .single();
      const recipient = await getNotificationRecipient(pid, channelType, player);
      if (!recipient) continue;

      const message = await generateNotificationMessage("mid_game_nudge", context);
      const body = message ?? `${submitted} of ${total} have placed. Submit your picks!`;
      const result = await channel.send(recipient.to, body);
      if (!result.success) {
        console.error("[notify-stale-check] mid_game_nudge failed:", result.error);
        continue;
      }
      await supabaseAdmin.from("notification_log").insert({
        player_id: pid,
        game_id: game.id,
        kind: "mid_game_nudge",
        channel: channelType,
        message: body.slice(0, 500),
      });
    }
  }
}

async function runResultsReminders(): Promise<void> {
  const cutoff = new Date(Date.now() - RESULTS_REMINDER_HOURS * 60 * 60 * 1000).toISOString();
  const { data: games } = await supabaseAdmin
    .from("games")
    .select("id, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
    .eq("phase", "results")
    .lt("created_at", cutoff);
  if (!games?.length) return;

  for (const game of games) {
    await sendResultsRemindersForGame(game);
  }
}

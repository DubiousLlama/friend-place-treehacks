import { supabaseAdmin } from "../_shared/supabase.ts";
import { getNotificationChannel, getChannelType } from "../_shared/notification-channel.ts";
import { getNotificationRecipient } from "../_shared/recipient.ts";
import { getReminderCountToday, canSendReminderToday } from "../_shared/reminder-limit.ts";
import {
  generateNotificationMessage,
  type GameContext,
} from "../_shared/ai.ts";

const MID_GAME_HOURS = 2;
const MID_GAME_PERCENT = 0.45;

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: WebhookPayload = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { type, table, record, old_record } = payload;
  if (table !== "game_players" || !record || typeof record !== "object") {
    return new Response(JSON.stringify({ ok: true, skipped: "not game_players" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const gameId = record.game_id as string | undefined;
  const playerId = record.player_id as string | null | undefined;
  const hasSubmitted = record.has_submitted as boolean | undefined;

  if (!gameId) {
    return new Response(JSON.stringify({ ok: true, skipped: "no game_id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (type === "INSERT" && playerId) {
      await sendNewGameInvite(gameId, playerId);
    } else if (type === "UPDATE" && hasSubmitted === true) {
      const oldSubmitted = (old_record as Record<string, unknown>)?.has_submitted;
      if (oldSubmitted !== true) {
        await maybeSendMidGameNudges(gameId);
      }
    }
  } catch (e) {
    console.error("[notify-game-event]", e);
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

async function sendNewGameInvite(gameId: string, playerId: string): Promise<void> {
  const channelType = getChannelType();
  const { data: game } = await supabaseAdmin
    .from("games")
    .select("id, invite_code, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
    .eq("id", gameId)
    .single();
  if (!game) return;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, phone, notifications_enabled")
    .eq("id", playerId)
    .single();
  const recipient = await getNotificationRecipient(playerId, channelType, player);
  if (!recipient) return;

  const { data: existing } = await supabaseAdmin
    .from("notification_log")
    .select("id")
    .eq("player_id", playerId)
    .eq("game_id", gameId)
    .eq("kind", "new_game_invite")
    .maybeSingle();
  if (existing) return;

  const context: GameContext = {
    axis_x_low: game.axis_x_label_low,
    axis_x_high: game.axis_x_label_high,
    axis_y_low: game.axis_y_label_low,
    axis_y_high: game.axis_y_label_high,
    inviteCode: game.invite_code,
  };
  const message = await generateNotificationMessage("new_game_invite", context);
  const body = message ?? `You were added to a FriendPlace game. Axes: ${game.axis_x_label_low}–${game.axis_x_label_high} / ${game.axis_y_label_low}–${game.axis_y_label_high}. Open the app to play!`;
  const channel = await getNotificationChannel();
  const result = await channel.send(recipient.to, body);
  if (!result.success) {
    console.error("[notify-game-event] send failed:", result.error);
    return;
  }
  await supabaseAdmin.from("notification_log").insert({
    player_id: playerId,
    game_id: gameId,
    kind: "new_game_invite",
    channel: channelType,
    message: body.slice(0, 500),
  });
}

async function maybeSendMidGameNudges(gameId: string): Promise<void> {
  const { data: game } = await supabaseAdmin
    .from("games")
    .select("id, invite_code, created_at, phase, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
    .eq("id", gameId)
    .single();
  if (!game || game.phase !== "placing") return;

  const created = new Date(game.created_at).getTime();
  const twoHoursAgo = Date.now() - MID_GAME_HOURS * 60 * 60 * 1000;
  if (created > twoHoursAgo) return;

  const { data: slots } = await supabaseAdmin
    .from("game_players")
    .select("id, player_id, display_name, has_submitted")
    .eq("game_id", gameId);
  if (!slots?.length) return;

  const total = slots.length;
  const submitted = slots.filter((s) => s.has_submitted).length;
  if (submitted / total < MID_GAME_PERCENT) return;

  const remaining = slots.filter((s) => !s.has_submitted && s.player_id);
  if (remaining.length === 0) return;

  const context: GameContext = {
    axis_x_low: game.axis_x_label_low,
    axis_x_high: game.axis_x_label_high,
    axis_y_low: game.axis_y_label_low,
    axis_y_high: game.axis_y_label_high,
    submittedCount: submitted,
    totalCount: total,
    playerNames: slots.map((s) => s.display_name),
    inviteCode: game.invite_code,
  };
  const channelType = getChannelType();
  const channel = await getNotificationChannel();

  for (const slot of remaining) {
    const pid = slot.player_id!;
    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id, phone, notifications_enabled")
      .eq("id", pid)
      .single();
    const recipient = await getNotificationRecipient(pid, channelType, player);
    if (!recipient) continue;

    const { data: existing } = await supabaseAdmin
      .from("notification_log")
      .select("id")
      .eq("player_id", pid)
      .eq("game_id", gameId)
      .eq("kind", "mid_game_nudge")
      .maybeSingle();
    if (existing) continue;

    const reminderCountToday = await getReminderCountToday(pid);
    if (!canSendReminderToday(reminderCountToday)) continue;

    const message = await generateNotificationMessage("mid_game_nudge", context);
    const body = message ?? `${submitted} of ${total} have placed. Don't miss out—submit your picks!`;
    const result = await channel.send(recipient.to, body);
    if (!result.success) {
      console.error("[notify-game-event] mid_game_nudge send failed:", result.error);
      continue;
    }
    await supabaseAdmin.from("notification_log").insert({
      player_id: pid,
      game_id: gameId,
      kind: "mid_game_nudge",
      channel: channelType,
      message: body.slice(0, 500),
    });
  }
}

import { supabaseAdmin } from "./supabase.ts";
import { getNotificationChannel, getChannelType } from "./notification-channel.ts";
import { getNotificationRecipient } from "./recipient.ts";
import {
  generateNotificationMessage,
  type GameContext,
} from "./ai.ts";

export interface GameRow {
  id: string;
  axis_x_label_low: string;
  axis_x_label_high: string;
  axis_y_label_low: string;
  axis_y_label_high: string;
}

/**
 * Send results_reminder to all players in this game who haven't viewed yet
 * (and haven't already been sent). No time cutoff — use for immediate notify on game end.
 */
export async function sendResultsRemindersForGame(game: GameRow): Promise<void> {
  const channelType = getChannelType();
  const channel = await getNotificationChannel();

  const { data: slots } = await supabaseAdmin
    .from("game_players")
    .select("id, player_id, display_name, results_viewed_at")
    .eq("game_id", game.id)
    .not("player_id", "is", null);
  if (!slots?.length) return;

  const notViewed = slots.filter((s) => s.results_viewed_at == null);
  if (notViewed.length === 0) return;

  const allDisplayNames = slots.map((s) => s.display_name);

  for (const slot of notViewed) {
    const pid = slot.player_id!;
    const { data: existing } = await supabaseAdmin
      .from("notification_log")
      .select("id")
      .eq("player_id", pid)
      .eq("game_id", game.id)
      .eq("kind", "results_reminder")
      .maybeSingle();
    if (existing) continue;

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id, phone, notifications_enabled")
      .eq("id", pid)
      .single();
    const recipient = await getNotificationRecipient(pid, channelType, player);
    if (!recipient) continue;

    const otherPlayerNames = allDisplayNames.filter((n) => n !== slot.display_name);
    const context: GameContext = {
      axis_x_low: game.axis_x_label_low,
      axis_x_high: game.axis_x_label_high,
      axis_y_low: game.axis_y_label_low,
      axis_y_high: game.axis_y_label_high,
      recipientDisplayName: slot.display_name ?? undefined,
      otherPlayerNames: otherPlayerNames.length > 0 ? otherPlayerNames : undefined,
      totalPlayerCount: slots.length,
    };

    const message = await generateNotificationMessage("results_reminder", context);
    const body = message ?? "Your Friend Place game results are in. See how your friends placed you!";
    const result = await channel.send(recipient.to, body);
    if (!result.success) {
      console.error("[results-reminder] send failed:", result.error);
      continue;
    }
    await supabaseAdmin.from("notification_log").insert({
      player_id: pid,
      game_id: game.id,
      kind: "results_reminder",
      channel: channelType,
      message: body.slice(0, 500),
    });
  }
}

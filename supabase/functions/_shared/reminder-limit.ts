import { supabaseAdmin } from "./supabase.ts";

const REMINDER_KINDS = ["results_reminder", "mid_game_nudge"];
const MAX_REMINDERS_PER_PERSON_PER_DAY = 2;

/**
 * Returns the number of reminder notifications (results_reminder, mid_game_nudge)
 * sent to this player today (UTC). Used to enforce max 2 per person per day.
 */
export async function getReminderCountToday(playerId: string): Promise<number> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const { count, error } = await supabaseAdmin
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .in("kind", REMINDER_KINDS)
    .gte("sent_at", todayStart.toISOString())
    .lt("sent_at", tomorrowStart.toISOString());

  if (error) {
    console.error("[reminder-limit] getReminderCountToday error:", error);
    return 0;
  }
  return count ?? 0;
}

export function canSendReminderToday(count: number): boolean {
  return count < MAX_REMINDERS_PER_PERSON_PER_DAY;
}

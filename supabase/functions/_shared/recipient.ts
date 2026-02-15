import { supabaseAdmin } from "./supabase.ts";
import type { ChannelType } from "./notification-channel.ts";

/**
 * Get the notification recipient address for a player.
 * - For email channel: returns the user's email from Auth (linked accounts only).
 * - For sms channel: returns the player's phone from the players table.
 * - For push: returns null (push uses subscription lookup elsewhere).
 */
export async function getNotificationRecipient(
  playerId: string,
  channel: ChannelType,
  playerRow?: { phone: string | null; notifications_enabled: boolean } | null
): Promise<{ to: string; notificationsEnabled: boolean } | null> {
  if (channel === "push") return null;
  if (channel === "sms") {
    if (!playerRow?.notifications_enabled || !playerRow?.phone?.trim()) return null;
    return { to: playerRow.phone.trim(), notificationsEnabled: true };
  }

  // email: get from Supabase Auth (user must have signed up with email or OAuth that provides email)
  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(playerId);
  if (error || !user?.email?.trim()) return null;

  const notificationsEnabled = playerRow?.notifications_enabled ?? true;
  if (!notificationsEnabled) return null;

  return { to: user.email.trim(), notificationsEnabled: true };
}

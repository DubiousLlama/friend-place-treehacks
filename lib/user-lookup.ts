import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-only: look up auth user and player by email.
 * Returns minimal data for invite flows.
 */
export async function lookupUserByEmail(email: string): Promise<{
  found: boolean;
  playerId?: string;
  displayName?: string | null;
}> {
  const emailLower = email.trim().toLowerCase();
  if (!emailLower || !emailLower.includes("@")) {
    return { found: false };
  }

  const admin = createAdminClient();
  let authUserId: string | null = null;
  let page = 1;
  const perPage = 50;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === emailLower);
    if (found) {
      authUserId = found.id;
      break;
    }
    if (!data.users.length || data.users.length < perPage) break;
    page += 1;
  }

  if (!authUserId) return { found: false };

  const { data: player } = await admin
    .from("players")
    .select("id, display_name")
    .eq("id", authUserId)
    .maybeSingle();

  const displayName = player?.display_name?.trim() ?? null;
  return { found: true, playerId: authUserId, displayName };
}

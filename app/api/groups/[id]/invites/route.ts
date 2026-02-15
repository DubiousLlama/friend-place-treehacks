import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskEmail } from "@/lib/utils";

export type GroupInviteItem = { id: string; masked_email: string; invited_by: string; expires_at: string };

/**
 * GET list of pending email invites for a group (masked email).
 * Caller must be group owner or member.
 */
export async function GET(
  _request: Request,
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

  const { data: group, error: groupErr } = await supabase
    .from("saved_groups")
    .select("id, owner_id")
    .eq("id", groupId)
    .single();
  if (groupErr || !group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const isOwner = group.owner_id === user.id;
  const { data: member } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("player_id", user.id)
    .maybeSingle();
  if (!isOwner && !member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: invites, error: inviteErr } = await admin
    .from("email_invites")
    .select("id, email, invited_by, expires_at")
    .eq("target_type", "group")
    .eq("target_id", groupId);

  if (inviteErr) {
    return NextResponse.json({ error: "Failed to load invites" }, { status: 500 });
  }

  const items: GroupInviteItem[] = (invites ?? []).map((inv) => ({
    id: inv.id,
    masked_email: maskEmail(inv.email),
    invited_by: inv.invited_by,
    expires_at: inv.expires_at,
  }));

  return NextResponse.json({ invites: items });
}

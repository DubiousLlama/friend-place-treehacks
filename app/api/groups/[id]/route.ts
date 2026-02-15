import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

const MAX_INTERESTS = 20;
const MAX_LENGTH_PER_INTEREST = 50;

/**
 * PATCH /api/groups/[id]
 *
 * Update group (e.g. interests). Caller must be a group member (RLS enforces).
 * Body: { interests?: string[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
  const rawInterests = body.interests;
  if (!Array.isArray(rawInterests)) {
    return NextResponse.json(
      { error: "interests must be an array of strings" },
      { status: 400 },
    );
  }

  const interests = rawInterests
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim().slice(0, MAX_LENGTH_PER_INTEREST))
    .filter((s) => s.length > 0)
    .slice(0, MAX_INTERESTS);

  const { data: group, error: updateError } = await supabase
    .from("saved_groups")
    .update({ interests })
    .eq("id", groupId)
    .select("id, interests")
    .single();

  if (updateError) {
    if (updateError.code === "PGRST116") {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    console.error("[groups PATCH] update error:", updateError);
    return NextResponse.json(
      { error: "Failed to update group" },
      { status: 500 },
    );
  }

  return NextResponse.json({ group: { id: group.id, interests: group.interests } });
}

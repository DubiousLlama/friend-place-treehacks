import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { lookupUserByEmail } from "@/lib/user-lookup";

/**
 * Look up a user by email (auth + players).
 * Returns minimal data: { found, playerId?, displayName? }.
 * Only authenticated users can call (to prevent open enumeration).
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    const result = await lookupUserByEmail(email);
    if (!result.found) {
      return NextResponse.json({ found: false });
    }
    return NextResponse.json({
      found: true,
      playerId: result.playerId,
      displayName: result.displayName ?? undefined,
    });
  } catch (err) {
    console.error("[lookup-by-email] error:", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}

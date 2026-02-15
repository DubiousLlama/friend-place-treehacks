import { NextResponse } from "next/server";

/**
 * Local-only test: send one email via Resend using .env.local.
 * Use this to verify Resend works without deploying Edge Functions.
 *
 * POST /api/notifications/test
 * Body: { "to": "your@email.com" }
 *
 * Requires in .env.local: RESEND_API_KEY, RESEND_FROM_EMAIL (e.g. "FriendPlace <onboarding@resend.dev>")
 */
export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "FriendPlace <onboarding@resend.dev>";

  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }

  let body: { to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!to || !to.includes("@")) {
    return NextResponse.json(
      { error: "Body must include a valid 'to' email address" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: "FriendPlace: test email",
        text: "This is a test from your local notification setup. Resend is working.",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? `Resend API ${res.status}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

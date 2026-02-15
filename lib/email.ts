/**
 * Email sending for invites (group, game) and future daily reminders.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs (stub).
 */

export type InviteEmailType = "group" | "game";

export interface SendInviteEmailParams {
  to: string;
  type: InviteEmailType;
  groupName?: string;
  inviteCode?: string;
  joinUrl: string;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Friend Place <onboarding@resend.dev>";

function buildInviteSubject(params: SendInviteEmailParams): string {
  if (params.type === "group") {
    return `You're invited to join ${params.groupName ?? "a group"} on Friend Place`;
  }
  return "You're invited to a game on Friend Place";
}

function buildInviteHtml(params: SendInviteEmailParams): string {
  const { type, groupName, inviteCode, joinUrl } = params;
  const cta = type === "game" ? "Join the game" : "Join now";
  const preheader =
    type === "group"
      ? `Join ${groupName ?? "the group"} on Friend Place.`
      : "Click the link below to join the game.";
  const expiryLine =
    type === "game"
      ? "<p style=\"font-size: 12px; color: #999;\">Your reserved spot will be held for 7 days.</p>"
      : "<p style=\"font-size: 12px; color: #999;\">This invite link will expire in 7 days.</p>";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 480px; margin: 0 auto; padding: 24px;">
  <p>${preheader}</p>
  <p><a href="${joinUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">${cta}</a></p>
  <p style="font-size: 14px; color: #666;">Or copy this link: ${joinUrl}</p>
  ${inviteCode ? `<p style="font-size: 14px; color: #666;">Game code: ${inviteCode}</p>` : ""}
  ${expiryLine}
</body>
</html>
`.trim();
}

export async function sendInviteEmail(params: SendInviteEmailParams): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "lib/email.ts:sendInviteEmail",
      message: "sendInviteEmail called",
      data: { to: params.to, type: params.type, hasResendKey: !!key },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  if (!key) {
    console.log("[email] Stub: would send invite email", {
      to: params.to,
      type: params.type,
      joinUrl: params.joinUrl,
    });
    return { ok: true };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const subject = buildInviteSubject(params);
    const html = buildInviteHtml(params);
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject,
      html,
    });
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "lib/email.ts:sendInviteEmail",
        message: "Resend send result",
        data: { ok: !error, error: error?.message },
        timestamp: Date.now(),
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    if (error) {
      console.error("[email] Resend error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/51997ba0-9d25-4154-b510-db94c1e13d2e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "lib/email.ts:sendInviteEmail",
        message: "sendInviteEmail exception",
        data: { error: message },
        timestamp: Date.now(),
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    console.error("[email] Send failed:", message);
    return { ok: false, error: message };
  }
}

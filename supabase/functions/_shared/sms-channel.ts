import type { NotificationChannel } from "./notification-channel.ts";

function base64Encode(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

export function createSmsChannel(): NotificationChannel {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

  return {
    async send(to: string, body: string): Promise<{ success: boolean; error?: string }> {
      if (!accountSid || !authToken || !fromNumber) {
        return { success: false, error: "Twilio is not configured (missing env vars)" };
      }
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${base64Encode(`${accountSid}:${authToken}`)}`,
            },
            body: new URLSearchParams({
              To: to,
              From: fromNumber,
              Body: body,
            }).toString(),
          }
        );
        const data = await res.json();
        if (data.error_code) {
          return {
            success: false,
            error: data.message ?? data.error_message ?? "Twilio error",
          };
        }
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Failed to send SMS",
        };
      }
    },
  };
}

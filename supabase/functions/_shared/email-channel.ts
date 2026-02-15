import type { NotificationChannel } from "./notification-channel.ts";

const RESEND_API = "https://api.resend.com/emails";

export function createEmailChannel(): NotificationChannel {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "FriendPlace <onboarding@resend.dev>";
  const subjectPrefix = Deno.env.get("RESEND_SUBJECT_PREFIX") ?? "FriendPlace: ";

  return {
    async send(to: string, body: string): Promise<{ success: boolean; error?: string }> {
      if (!apiKey) {
        return { success: false, error: "RESEND_API_KEY is not set" };
      }
      if (!to || !to.includes("@")) {
        return { success: false, error: "Invalid email address" };
      }
      try {
        const res = await fetch(RESEND_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [to],
            subject: `${subjectPrefix}Game reminder`,
            text: body,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return {
            success: false,
            error: data.message ?? data.error ?? `Resend API ${res.status}`,
          };
        }
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Failed to send email",
        };
      }
    },
  };
}

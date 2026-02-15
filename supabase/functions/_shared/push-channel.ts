import type { NotificationChannel } from "./notification-channel.ts";

/**
 * Stub for Web Push. When NOTIFICATION_CHANNEL=push, implement actual
 * push subscription lookup and web-push send here.
 */
export function createPushChannel(): NotificationChannel {
  return {
    async send(_to: string, body: string): Promise<{ success: boolean; error?: string }> {
      console.warn("[push-channel] Web Push not implemented; would have sent:", body?.slice(0, 80));
      return { success: true };
    },
  };
}

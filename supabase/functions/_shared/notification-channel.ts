export type ChannelType = "email" | "sms" | "push";

export interface NotificationChannel {
  send(to: string, body: string): Promise<{ success: boolean; error?: string }>;
}

const channel = (Deno.env.get("NOTIFICATION_CHANNEL") ?? "email") as ChannelType;

export function getChannelType(): ChannelType {
  return channel === "push" || channel === "sms" ? channel : "email";
}

export async function getNotificationChannel(): Promise<NotificationChannel> {
  if (channel === "push") {
    const m = await import("./push-channel.ts");
    return m.createPushChannel();
  }
  if (channel === "sms") {
    const m = await import("./sms-channel.ts");
    return m.createSmsChannel();
  }
  const m = await import("./email-channel.ts");
  return m.createEmailChannel();
}

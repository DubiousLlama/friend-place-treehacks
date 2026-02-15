/**
 * Twilio SMS provider. Uses Twilio REST API to send SMS.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (E.164).
 * To swap providers later, implement SmsProvider and use it where getSmsProvider() is used.
 */

import type { SmsProvider, SendSmsResult } from "./types";

export function createTwilioSmsProvider(): SmsProvider {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  return {
    async send(to: string, body: string): Promise<SendSmsResult> {
      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          error: "Twilio is not configured (missing env vars)",
        };
      }

      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
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
        return { success: true, messageId: data.sid };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Failed to send SMS",
        };
      }
    },
  };
}

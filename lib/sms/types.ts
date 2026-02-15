/**
 * SMS provider interface so we can swap Twilio for another provider
 * (e.g. for reminder texts, notifications) without changing call sites.
 *
 * Sign-in OTP is handled by Supabase Auth with Twilio configured in the
 * Supabase dashboard; this abstraction is for app-initiated SMS (reminders, etc.).
 */

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  /** Send an SMS to the given E.164 phone number. */
  send(to: string, body: string): Promise<SendSmsResult>;
}

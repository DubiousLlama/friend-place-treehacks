/**
 * SMS sending for app use (e.g. reminder texts). Swap the provider here
 * or via env to change from Twilio to another service.
 *
 * Sign-in OTP is sent by Supabase Auth (configure Twilio in Supabase dashboard).
 */

import type { SmsProvider } from "./types";
import { createTwilioSmsProvider } from "./twilio-provider";

let _provider: SmsProvider | null = null;

/** Get the configured SMS provider. Defaults to Twilio when env is set. */
export function getSmsProvider(): SmsProvider | null {
  if (_provider) return _provider;
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  ) {
    _provider = createTwilioSmsProvider();
    return _provider;
  }
  return null;
}

/** Set a custom provider (e.g. for testing or a different vendor). */
export function setSmsProvider(provider: SmsProvider | null): void {
  _provider = provider;
}

export type { SmsProvider, SendSmsResult } from "./types";
export { createTwilioSmsProvider } from "./twilio-provider";

import type { SmsAdapter } from "./adapter";
import { FakeSmsAdapter } from "./fake-adapter";
import { TwilioSmsAdapter } from "./twilio-adapter";

export type { SmsAdapter, SendSmsInput, SendSmsResult } from "./adapter";
export { FakeSmsAdapter } from "./fake-adapter";

let cached: SmsAdapter | undefined;

/** Feature flag (Event night, item 10) — outbid texts stay off even with
 * Twilio credentials present, unless explicitly turned on. Off by
 * default: sending a surprise text to a donor's phone is the kind of
 * thing that should be an opt-in decision, not a side effect of setting
 * up credentials for something else. */
export function isOutbidSmsEnabled(): boolean {
  return process.env.ENABLE_OUTBID_SMS === "true";
}

/** Picks the real Twilio adapter only when both the feature flag is on
 * and all three Twilio credentials are set; the fake otherwise — same
 * "unset/disabled = inert" convention as every other integration here. */
export function getSmsAdapter(): SmsAdapter {
  if (cached) return cached;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  cached =
    isOutbidSmsEnabled() && accountSid && authToken && fromNumber
      ? new TwilioSmsAdapter(accountSid, authToken, fromNumber)
      : new FakeSmsAdapter();
  return cached;
}

/** Test-only: swap in a specific adapter and clear the cache. */
export function setSmsAdapterForTesting(adapter: SmsAdapter | undefined): void {
  cached = adapter;
}

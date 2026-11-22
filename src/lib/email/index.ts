import type { EmailAdapter } from "./adapter";
import { FakeEmailAdapter } from "./fake-adapter";
import { ResendEmailAdapter } from "./resend-adapter";

export type { EmailAdapter, SendEmailInput, SendEmailResult, EmailAttachment } from "./adapter";
export { FakeEmailAdapter } from "./fake-adapter";

let cached: EmailAdapter | undefined;

/** Picks the real Resend adapter when both RESEND_API_KEY and
 * EMAIL_FROM_ADDRESS are set, otherwise the fake — same "unset =
 * disabled" convention as every other credential in this app. */
export function getEmailAdapter(): EmailAdapter {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  cached = apiKey && fromAddress ? new ResendEmailAdapter(apiKey, fromAddress) : new FakeEmailAdapter();
  return cached;
}

/** Test-only: swap in a specific adapter and clear the cache. */
export function setEmailAdapterForTesting(adapter: EmailAdapter | undefined): void {
  cached = adapter;
}

import { randomUUID } from "node:crypto";
import type { EmailAdapter, SendEmailInput, SendEmailResult } from "./adapter";

/**
 * Default/test implementation — never actually sends anything, just
 * records what would have gone out so tests (and local dev without a
 * RESEND_API_KEY) can assert on it without real credentials or a real
 * inbox. Mirrors FakeEtapestryAdapter's role for the sync queue.
 */
export class FakeEmailAdapter implements EmailAdapter {
  sent: SendEmailInput[] = [];

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    this.sent.push(input);
    return { ok: true, messageId: `fake-${randomUUID()}` };
  }

  reset(): void {
    this.sent = [];
  }
}

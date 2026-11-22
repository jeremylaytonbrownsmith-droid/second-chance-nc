import { randomUUID } from "node:crypto";
import type { SmsAdapter, SendSmsInput, SendSmsResult } from "./adapter";

/** Default/test implementation — records what would have gone out instead
 * of sending anything real. Mirrors FakeEmailAdapter's role. */
export class FakeSmsAdapter implements SmsAdapter {
  sent: SendSmsInput[] = [];

  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    this.sent.push(input);
    return { ok: true, messageId: `fake-${randomUUID()}` };
  }

  reset(): void {
    this.sent = [];
  }
}

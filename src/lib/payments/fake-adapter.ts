import { randomUUID } from "node:crypto";
import type { ChargeInput, ChargeResult, PaymentProcessor } from "./adapter";

/**
 * Default/test implementation — never actually charges anything, just
 * records what would have gone out so tests (and local dev without
 * STRIPE_SECRET_KEY) can assert on it without real credentials or a real
 * card. Always succeeds, matching the old hardcoded "demo" charge's
 * behavior exactly so demo mode's experience doesn't change.
 */
export class FakePaymentProcessor implements PaymentProcessor {
  readonly name = "demo";
  charges: ChargeInput[] = [];

  async charge(input: ChargeInput): Promise<ChargeResult> {
    this.charges.push(input);
    return { ok: true, processorRef: `demo-charge-${randomUUID().slice(0, 8)}` };
  }

  reset(): void {
    this.charges = [];
  }
}

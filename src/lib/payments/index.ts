import type { PaymentProcessor } from "./adapter";
import { FakePaymentProcessor } from "./fake-adapter";
import { StripePaymentProcessor } from "./stripe-adapter";

export type { ChargeInput, ChargeResult, PaymentProcessor } from "./adapter";
export { FakePaymentProcessor } from "./fake-adapter";

let cached: PaymentProcessor | undefined;

/** Picks the real Stripe adapter when STRIPE_SECRET_KEY is set,
 * otherwise the fake — same "unset = disabled" convention as every
 * other credential in this app. */
export function getPaymentProcessor(): PaymentProcessor {
  if (cached) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  cached = secretKey ? new StripePaymentProcessor(secretKey) : new FakePaymentProcessor();
  return cached;
}

/** Test-only: swap in a specific processor and clear the cache. */
export function setPaymentProcessorForTesting(processor: PaymentProcessor | undefined): void {
  cached = processor;
}

/**
 * Payment processor adapter — same reasoning as every other adapter in
 * this app (src/lib/etapestry, src/lib/email, src/lib/sms): nothing else
 * should know which gateway actually moves money, or how. Swapping
 * processors later means writing a new adapter, not touching checkout.
 *
 * CLAUDE.md hard rule 1 still applies here above all: this interface
 * never takes or returns a card number. It only ever sees the processor
 * tokens already on Registration.paymentCustomerRef /
 * Registration.paymentMethodRef — a customer reference and a payment
 * method reference, nothing else. Those tokens are created by whatever
 * client-side flow collects the card (e.g. a Stripe Elements form) and
 * are out of scope for this adapter; it only ever charges a card already
 * on file, never raw card data.
 *
 * No real processor is wired in by default — set STRIPE_SECRET_KEY to
 * turn on StripePaymentProcessor (src/lib/payments/stripe-adapter.ts);
 * until then, and in every test, FakePaymentProcessor stands in and
 * always succeeds, exactly like the old hardcoded "demo" charge did.
 */

export interface ChargeInput {
  amountCents: number;
  /** Registration.paymentCustomerRef — null means "no card on file", which
   * a real processor should treat as a hard failure, not silently skip. */
  customerRef: string | null;
  /** Registration.paymentMethodRef — same null handling as customerRef. */
  paymentMethodRef: string | null;
  description: string;
  /** Resent unchanged on a retry of the same checkout attempt so a
   * network hiccup can never double-charge a card — passed through as
   * the processor's own idempotency key, not re-derived. */
  idempotencyKey: string;
}

export type ChargeResult =
  | { ok: true; processorRef: string }
  | { ok: false; declineReason: string };

export interface PaymentProcessor {
  /** Recorded on Transaction.processor — identifies which adapter ran a
   * given charge directly from the result, rather than inferred from
   * environment state that could drift out of sync with it. */
  readonly name: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
}

import type { ChargeInput, ChargeResult, PaymentProcessor } from "./adapter";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

interface StripePaymentIntentResponse {
  id: string;
  status: string;
  last_payment_error?: { message?: string };
}

/**
 * Real card charges via Stripe's REST API — a plain fetch() call, not
 * the Stripe Node SDK, so this doesn't add a new npm dependency for one
 * POST request (same choice already made for Resend and Twilio).
 * Requires STRIPE_SECRET_KEY; validated at construction so a
 * misconfiguration fails loudly at startup rather than silently
 * declining every card.
 *
 * Charges an existing customer + payment method off-session (the card
 * was already collected and tokenized by whatever client-side flow adds
 * it to a Registration — see adapter.ts's hard-rule-1 note) — this
 * adapter never collects or sees a raw card number.
 *
 * Known limitation, worth fixing before relying on this for a real
 * event: a charge that comes back `requires_action` (e.g. a 3-D Secure
 * challenge) is treated as a decline here rather than walked through to
 * completion, since that needs a client-side confirmation step and a
 * webhook this app doesn't have yet. Off-session charges rarely trigger
 * that, but it can happen — worth a manual Stripe Dashboard check if a
 * guest insists their card is fine and checkout still declines it.
 */
export class StripePaymentProcessor implements PaymentProcessor {
  readonly name = "stripe";
  private readonly secretKey: string;

  constructor(secretKey: string) {
    if (!secretKey) {
      throw new Error("StripePaymentProcessor requires a non-empty secret key.");
    }
    this.secretKey = secretKey;
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!input.customerRef || !input.paymentMethodRef) {
      return { ok: false, declineReason: "No card on file for this bidder." };
    }

    const body = new URLSearchParams({
      amount: String(input.amountCents),
      currency: "usd",
      customer: input.customerRef,
      payment_method: input.paymentMethodRef,
      description: input.description,
      off_session: "true",
      confirm: "true",
    });

    let res: Response;
    try {
      res = await fetch(`${STRIPE_API_BASE}/payment_intents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": input.idempotencyKey,
        },
        body,
      });
    } catch (error) {
      return {
        ok: false,
        declineReason: `Couldn't reach Stripe: ${error instanceof Error ? error.message : "network error"}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as StripePaymentIntentResponse & {
      error?: { message?: string };
    };

    if (!res.ok) {
      return { ok: false, declineReason: data.error?.message ?? `Stripe API ${res.status}` };
    }
    if (data.status !== "succeeded") {
      return {
        ok: false,
        declineReason: data.last_payment_error?.message ?? `Card not charged (status: ${data.status}).`,
      };
    }

    return { ok: true, processorRef: data.id };
  }
}

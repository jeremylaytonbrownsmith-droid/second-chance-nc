import { afterEach, describe, expect, it, vi } from "vitest";
import { StripePaymentProcessor } from "./stripe-adapter";

describe("StripePaymentProcessor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws at construction with an empty secret key", () => {
    expect(() => new StripePaymentProcessor("")).toThrow();
  });

  it("declines without calling Stripe when there's no card on file", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const processor = new StripePaymentProcessor("sk_test_123");
    const result = await processor.charge({
      amountCents: 5_000,
      customerRef: null,
      paymentMethodRef: "pm_123",
      description: "test",
      idempotencyKey: "idem-1",
    });

    expect(result).toEqual({ ok: false, declineReason: "No card on file for this bidder." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the expected request shape for a charge", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "pi_abc123", status: "succeeded" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const processor = new StripePaymentProcessor("sk_test_123");
    const result = await processor.charge({
      amountCents: 5_500,
      customerRef: "cus_1",
      paymentMethodRef: "pm_1",
      description: "Checkout for registration reg_1",
      idempotencyKey: "idem-2",
    });

    expect(result).toEqual({ ok: true, processorRef: "pi_abc123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/payment_intents");
    expect(init.headers.Authorization).toBe("Bearer sk_test_123");
    expect(init.headers["Idempotency-Key"]).toBe("idem-2");
    const body = new URLSearchParams(init.body);
    expect(body.get("amount")).toBe("5500");
    expect(body.get("currency")).toBe("usd");
    expect(body.get("customer")).toBe("cus_1");
    expect(body.get("payment_method")).toBe("pm_1");
    expect(body.get("confirm")).toBe("true");
    expect(body.get("off_session")).toBe("true");
  });

  it("reports a decline when Stripe returns a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: "Your card was declined." } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const processor = new StripePaymentProcessor("sk_test_123");
    const result = await processor.charge({
      amountCents: 1_000,
      customerRef: "cus_1",
      paymentMethodRef: "pm_1",
      description: "test",
      idempotencyKey: "idem-3",
    });

    expect(result).toEqual({ ok: false, declineReason: "Your card was declined." });
  });

  it("reports a decline when the payment intent doesn't come back succeeded", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "pi_xyz",
        status: "requires_action",
        last_payment_error: { message: "Authentication required." },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const processor = new StripePaymentProcessor("sk_test_123");
    const result = await processor.charge({
      amountCents: 1_000,
      customerRef: "cus_1",
      paymentMethodRef: "pm_1",
      description: "test",
      idempotencyKey: "idem-4",
    });

    expect(result).toEqual({ ok: false, declineReason: "Authentication required." });
  });

  it("reports a decline when Stripe can't be reached at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    const processor = new StripePaymentProcessor("sk_test_123");
    const result = await processor.charge({
      amountCents: 1_000,
      customerRef: "cus_1",
      paymentMethodRef: "pm_1",
      description: "test",
      idempotencyKey: "idem-5",
    });

    expect(result.ok).toBe(false);
    expect((result as { declineReason: string }).declineReason).toMatch(/couldn't reach stripe/i);
  });
});

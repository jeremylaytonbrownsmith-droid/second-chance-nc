import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * This module is written for a browser (`"use client"`), but its logic —
 * queue ordering, retry-on-network-failure, drop-on-real-rejection,
 * persistence across "reloads" — doesn't need a real DOM to verify, just
 * the handful of browser globals it actually touches. Shimmed here
 * instead of pulling in jsdom as a new dependency for one test file.
 */
function installBrowserShims() {
  const store = new Map<string, string>();
  const listeners: Record<string, Set<() => void>> = { online: new Set(), offline: new Set() };

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    addEventListener: (event: string, handler: () => void) => {
      listeners[event]?.add(handler);
    },
    removeEventListener: (event: string, handler: () => void) => {
      listeners[event]?.delete(handler);
    },
  };

  return {
    fireOnline: () => listeners.online.forEach((h) => h()),
    fireOffline: () => listeners.offline.forEach((h) => h()),
  };
}

describe("bid offline queue", () => {
  let shims: ReturnType<typeof installBrowserShims>;

  beforeEach(() => {
    vi.resetModules();
    shims = installBrowserShims();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("sends a queued bid immediately when the network is up", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ currentAmountCents: 1_000, bidCount: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { enqueueBid, subscribeBidQueueOutcomes } = await import("./bid-queue");
    const outcomes: unknown[] = [];
    subscribeBidQueueOutcomes((o) => outcomes.push(o));

    enqueueBid({ itemId: "item1", registrationId: "reg1", amountCents: 1_000, source: "MOBILE", isMaxBid: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(outcomes).toHaveLength(1));

    expect(outcomes[0]).toMatchObject({ ok: true, currentAmountCents: 1_000 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.clientRequestId).toBeTruthy();
    expect(body.itemId).toBe("item1");
  });

  it("keeps a bid queued across repeated network failures, then sends it once the network recovers", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ currentAmountCents: 2_000, bidCount: 1 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { enqueueBid, subscribeBidQueue, flush } = await import("./bid-queue");
    const states: { pending: unknown[]; isOffline: boolean }[] = [];
    subscribeBidQueue((s) => states.push(s));

    enqueueBid({ itemId: "item1", registrationId: "reg1", amountCents: 2_000, source: "MOBILE", isMaxBid: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(states.at(-1)?.pending).toHaveLength(1);
    expect(states.at(-1)?.isOffline).toBe(true);

    await flush(); // simulates the retry timer firing again — still offline
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(states.at(-1)?.pending).toHaveLength(1);

    shims.fireOnline(); // network recovers — this itself triggers a flush
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(states.at(-1)?.pending).toHaveLength(0));
    expect(states.at(-1)?.isOffline).toBe(false);
  });

  it("drops the entry and reports the outcome when the server actually rejects the bid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "bid_too_low", message: "Minimum bid is 5000 cents" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { enqueueBid, subscribeBidQueue, subscribeBidQueueOutcomes } = await import("./bid-queue");
    const outcomes: { ok: boolean; message?: string }[] = [];
    subscribeBidQueueOutcomes((o) => outcomes.push(o));
    const states: { pending: unknown[] }[] = [];
    subscribeBidQueue((s) => states.push(s));

    enqueueBid({ itemId: "item1", registrationId: "reg1", amountCents: 1_000, source: "MOBILE", isMaxBid: false });
    await vi.waitFor(() => expect(outcomes).toHaveLength(1));

    expect(outcomes[0]).toMatchObject({ ok: false, message: "Minimum bid is 5000 cents" });
    expect(states.at(-1)?.pending).toHaveLength(0); // not retried — a real rejection, not a network drop
  });

  it("persists the queue across a simulated reload (fresh module import)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const first = await import("./bid-queue");
    first.enqueueBid({ itemId: "item1", registrationId: "reg1", amountCents: 1_000, source: "MOBILE", isMaxBid: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    vi.resetModules(); // drops the in-memory module state, not localStorage
    const second = await import("./bid-queue");
    const states: { pending: unknown[] }[] = [];
    second.subscribeBidQueue((s) => states.push(s));

    expect(states[0]?.pending).toHaveLength(1); // reloaded from localStorage, not lost
  });

  it("sends same-item bids in queued order, one at a time", async () => {
    const callOrder: number[] = [];
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      callOrder.push(body.amountCents);
      return { ok: true, json: async () => ({ currentAmountCents: body.amountCents, bidCount: callOrder.length }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { enqueueBid } = await import("./bid-queue");
    enqueueBid({ itemId: "item1", registrationId: "reg1", amountCents: 1_000, source: "MOBILE", isMaxBid: false });
    enqueueBid({ itemId: "item1", registrationId: "reg1", amountCents: 1_100, source: "MOBILE", isMaxBid: false });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(callOrder).toEqual([1_000, 1_100]);
  });
});

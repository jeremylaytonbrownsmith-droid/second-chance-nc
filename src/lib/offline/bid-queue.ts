"use client";

/**
 * Event night item 15 (offline resilience): venue wifi drops, a bidder's
 * phone can't reach /api/bid for a few seconds or a few minutes. Instead
 * of just showing "network error, try again" and hoping the bidder
 * remembers to retry, queue the attempt in localStorage (survives a page
 * reload, not just an in-memory retry) and keep retrying automatically —
 * on an interval while anything is queued, and immediately when the
 * browser reports it's back online.
 *
 * Each queued entry carries a clientRequestId generated once, at
 * enqueue time, and resent unchanged on every retry. The server
 * (placeBid in src/lib/auction/bidding.ts) treats a repeat of the same
 * id as "did this land already?", not "place it again" — the real
 * protection against a request that actually succeeded server-side but
 * whose response never made it back before the connection dropped, or
 * against a user tapping "bid" again out of impatience while queued.
 *
 * This module is deliberately plain functions + a module-level array,
 * not a React hook — it has to keep retrying even if the component that
 * enqueued the bid unmounts (the bidder closes the tab's current view
 * but the browser/tab itself stays open).
 */

export interface QueuedBid {
  clientRequestId: string;
  itemId: string;
  registrationId: string;
  amountCents: number;
  source: "MOBILE" | "PAPER" | "AUCTIONEER";
  isMaxBid: boolean;
  queuedAt: number;
  attempts: number;
}

export interface FlushOutcome {
  clientRequestId: string;
  ok: boolean;
  /** Present when ok — the server's current, authoritative state. */
  currentAmountCents?: number;
  bidCount?: number;
  /** Present when ok is false and the rejection is final (not a network
   * error) — e.g. the item closed, or someone else is now leading above
   * this bid. The entry is removed from the queue either way in that
   * case; retrying a request the server has actively rejected would
   * just get rejected again. */
  message?: string;
}

const STORAGE_KEY = "scnc:bid-queue:v1";
const RETRY_INTERVAL_MS = 4_000;

type Listener = (state: { pending: QueuedBid[]; isOffline: boolean }) => void;
type OutcomeListener = (outcome: FlushOutcome) => void;

let pending: QueuedBid[] = [];
let isOffline = false;
let flushing = false;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;
const listeners = new Set<Listener>();
const outcomeListeners = new Set<OutcomeListener>();

function loadFromStorage(): QueuedBid[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedBid[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Private browsing / storage full — the queue still works for this
    // tab's lifetime, it just won't survive a reload. Not worth erroring
    // over for a best-effort convenience layer.
  }
}

function notifyListeners() {
  const snapshot = { pending: [...pending], isOffline };
  for (const listener of listeners) listener(snapshot);
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  pending = loadFromStorage();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    // Page loaded already offline (e.g. airplane mode) — the "offline"
    // event only fires on a transition, so this is the only signal for
    // that starting state.
    isOffline = true;
  }
  window.addEventListener("online", () => {
    isOffline = false;
    notifyListeners();
    void flush();
  });
  window.addEventListener("offline", () => {
    isOffline = true;
    notifyListeners();
  });
  if (pending.length > 0) {
    ensureRetryTimer();
    void flush();
  }
}

function ensureRetryTimer() {
  if (retryTimer !== null) return;
  retryTimer = setInterval(() => void flush(), RETRY_INTERVAL_MS);
}

function stopRetryTimerIfIdle() {
  if (pending.length === 0 && retryTimer !== null) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

export function subscribeBidQueue(listener: Listener): () => void {
  ensureInitialized();
  listeners.add(listener);
  listener({ pending: [...pending], isOffline });
  return () => listeners.delete(listener);
}

export function subscribeBidQueueOutcomes(listener: OutcomeListener): () => void {
  outcomeListeners.add(listener);
  return () => outcomeListeners.delete(listener);
}

export function enqueueBid(input: {
  itemId: string;
  registrationId: string;
  amountCents: number;
  source: "MOBILE" | "PAPER" | "AUCTIONEER";
  isMaxBid: boolean;
}): string {
  ensureInitialized();
  const clientRequestId = crypto.randomUUID();
  pending.push({ ...input, clientRequestId, queuedAt: Date.now(), attempts: 0 });
  saveToStorage();
  ensureRetryTimer();
  notifyListeners();
  void flush();
  return clientRequestId;
}

export async function flush(): Promise<void> {
  ensureInitialized();
  if (flushing) return;
  flushing = true;
  try {
    // Sequential, in queued order — a bid can't safely jump ahead of an
    // earlier one on the same item (ordering matters for minimum-bid
    // checks), and the server only has to handle one request at a time
    // per queue instead of a burst.
    while (pending.length > 0) {
      const entry = pending[0];
      entry.attempts += 1;
      saveToStorage();

      let response: Response;
      try {
        response = await fetch("/api/bid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: entry.itemId,
            registrationId: entry.registrationId,
            amountCents: entry.amountCents,
            source: entry.source,
            isMaxBid: entry.isMaxBid,
            clientRequestId: entry.clientRequestId,
          }),
        });
      } catch {
        // Network-level failure — still offline (or flaky). Stop here,
        // keep this entry (and everything after it) queued, try again
        // on the next timer tick or the next "online" event.
        isOffline = true;
        notifyListeners();
        return;
      }

      isOffline = false;
      const data = await response.json().catch(() => ({}));
      pending = pending.filter((p) => p.clientRequestId !== entry.clientRequestId);
      saveToStorage();
      notifyListeners();

      const outcome: FlushOutcome = response.ok
        ? {
            clientRequestId: entry.clientRequestId,
            ok: true,
            currentAmountCents: data.currentAmountCents,
            bidCount: data.bidCount,
          }
        : { clientRequestId: entry.clientRequestId, ok: false, message: data.message ?? "Bid rejected." };
      for (const listener of outcomeListeners) listener(outcome);
    }
  } finally {
    flushing = false;
    stopRetryTimerIfIdle();
  }
}

"use client";

import { useEffect, useRef, useState } from "react";

interface ItemViewModel {
  id: string;
  itemNumber: string;
  title: string;
  itemType: string;
  fmvCents: number | null;
  bidIncrementCents: number | null;
  status: string;
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
}

interface RegistrationOption {
  id: string;
  bidderNumber: number;
  name: string;
}

interface ActivityEntry {
  id: string;
  itemNumber: string;
  itemTitle: string;
  amountCents: number;
  bidderNumber: number | null;
  serverTimestamp: string;
}

interface BidUpdateEvent {
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
  serverTimestamp?: string;
}

const RATE_LIMIT_COOLDOWN_MS = 2_200;

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function LiveBoard({
  isDemo,
  registrations,
  items: initialItems,
}: {
  eventId: string;
  isDemo: boolean;
  registrations: RegistrationOption[];
  items: ItemViewModel[];
}) {
  const [items, setItems] = useState(initialItems);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [cooldownRegistrationIds, setCooldownRegistrationIds] = useState<Set<string>>(
    new Set(),
  );
  const itemsRef = useRef(initialItems);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const applyUpdate = (itemId: string, data: BidUpdateEvent, isNewBid: boolean) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                currentAmountCents: data.currentAmountCents,
                leadingBidderNumber: data.leadingBidderNumber,
                bidCount: data.bidCount,
              }
            : it,
        ),
      );
      if (isNewBid) {
        const item = itemsRef.current.find((it) => it.id === itemId);
        setActivity((prev) => [
          {
            id: crypto.randomUUID(),
            itemNumber: item?.itemNumber ?? "",
            itemTitle: item?.title ?? "",
            amountCents: data.currentAmountCents,
            bidderNumber: data.leadingBidderNumber,
            serverTimestamp: data.serverTimestamp ?? new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 25));
      }
    };

    const sources = initialItems.map((item) => {
      const es = new EventSource(`/api/realtime/items/${item.id}`);
      es.addEventListener("snapshot", (e) => {
        applyUpdate(item.id, JSON.parse((e as MessageEvent).data), false);
      });
      es.addEventListener("bid", (e) => {
        applyUpdate(item.id, JSON.parse((e as MessageEvent).data), true);
      });
      return es;
    });

    return () => sources.forEach((es) => es.close());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function simulateBid(item: ItemViewModel, registration: RegistrationOption) {
    if (cooldownRegistrationIds.has(registration.id)) return;
    setCooldownRegistrationIds((prev) => new Set(prev).add(registration.id));
    setTimeout(() => {
      setCooldownRegistrationIds((prev) => {
        const next = new Set(prev);
        next.delete(registration.id);
        return next;
      });
    }, RATE_LIMIT_COOLDOWN_MS);

    const increment = item.bidIncrementCents ?? 100;
    const nextBid = item.currentAmountCents + increment;
    await fetch("/api/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: item.id,
        registrationId: registration.id,
        amountCents: nextBid,
        source: "MOBILE",
      }),
    }).catch(() => {
      // Board reconciles from the next SSE snapshot/reconnect regardless.
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {items.map((item) => {
          const increment = item.bidIncrementCents ?? 100;
          const nextBid = item.currentAmountCents + increment;
          return (
            <div
              key={item.id}
              className="rounded-lg border border-brand-lavender bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    {item.itemType} · {item.itemNumber}
                  </div>
                  <div className="text-lg font-semibold">{item.title}</div>
                  <div className="text-xs text-neutral-500">
                    FMV {item.fmvCents !== null ? money(item.fmvCents) : "—"} ·{" "}
                    {item.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-brand-purple">
                    {money(item.currentAmountCents)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {item.bidCount} bid{item.bidCount === 1 ? "" : "s"}
                    {item.leadingBidderNumber !== null &&
                      ` · leading: #${item.leadingBidderNumber}`}
                  </div>
                </div>
              </div>

              {isDemo && item.status === "OPEN" && registrations.length > 0 && (
                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <div className="text-xs text-neutral-500">
                    Simulate a bid of {money(nextBid)} from:
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {registrations.map((reg) => (
                      <button
                        key={reg.id}
                        onClick={() => simulateBid(item, reg)}
                        disabled={cooldownRegistrationIds.has(reg.id)}
                        title={reg.name}
                        className="rounded-full border border-brand-purple px-3 py-1 text-xs font-medium text-brand-purple transition-colors hover:bg-brand-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        #{reg.bidderNumber}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-neutral-500">No auction items yet.</p>
        )}
      </div>

      <div className="rounded-lg border border-brand-lavender bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-semibold">Live activity</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Updates the instant a bid lands anywhere, from any device.
        </p>
        <div className="mt-3 space-y-2">
          {activity.map((entry) => (
            <div key={entry.id} className="border-b border-neutral-100 pb-2 text-sm">
              <span className="font-medium">
                #{entry.bidderNumber ?? "?"}
              </span>{" "}
              bid {money(entry.amountCents)} on {entry.itemNumber} — {entry.itemTitle}
              <div className="text-xs text-neutral-400">
                {new Date(entry.serverTimestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {activity.length === 0 && (
            <p className="text-sm text-neutral-500">No bids yet — this updates live.</p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

interface ItemViewModel {
  id: string;
  itemNumber: string;
  title: string;
  category: string | null;
  itemType: string;
  image: string | null;
  fmvCents: number | null;
  status: string;
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
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

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Coming soon",
  OPEN: "Open for bidding",
  CLOSED: "Bidding closed",
  AWARDED: "Sold",
  UNSOLD: "Unsold",
};

export function LiveEventBoard({ items: initialItems }: { items: ItemViewModel[] }) {
  const [items, setItems] = useState(initialItems);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
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
        setActivity((prev) =>
          [
            {
              id: crypto.randomUUID(),
              itemNumber: item?.itemNumber ?? "",
              itemTitle: item?.title ?? "",
              amountCents: data.currentAmountCents,
              bidderNumber: data.leadingBidderNumber,
              serverTimestamp: data.serverTimestamp ?? new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 20),
        );
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-lg transition-transform duration-150 hover:-translate-y-0.5"
          >
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-brand-purple/40 to-brand-purple-dark/40 text-xs uppercase tracking-wide text-white/40">
                {item.category ?? item.itemType}
              </div>
            )}
            <div className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/40">
                {item.itemNumber} {item.category ? `· ${item.category}` : ""}
              </div>
              <div className="mt-0.5 text-lg font-semibold leading-tight">{item.title}</div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-brand-lavender">
                    {money(item.currentAmountCents)}
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">
                    {item.bidCount} bid{item.bidCount === 1 ? "" : "s"}
                    {item.leadingBidderNumber !== null && (
                      <> · leading: #{item.leadingBidderNumber}</>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.status === "OPEN"
                      ? "bg-green-500/20 text-green-300"
                      : item.status === "AWARDED"
                        ? "bg-brand-lavender/20 text-brand-lavender"
                        : "bg-white/10 text-white/60"
                  }`}
                >
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-white/50">Items open up as the night gets going — check back soon.</p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-lg lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-semibold">Live activity</h2>
        <p className="mt-1 text-xs text-white/50">
          Updates the instant a bid lands, from anyone&rsquo;s phone.
        </p>
        <div className="mt-3 space-y-2.5">
          {activity.map((entry) => (
            <div key={entry.id} className="border-b border-white/10 pb-2.5 text-sm">
              <span className="font-medium text-brand-lavender">
                #{entry.bidderNumber ?? "?"}
              </span>{" "}
              bid {money(entry.amountCents)} on {entry.itemTitle}
              <div className="text-xs text-white/30">
                {new Date(entry.serverTimestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {activity.length === 0 && (
            <p className="text-sm text-white/50">No bids yet — this updates live.</p>
          )}
        </div>
      </div>
    </div>
  );
}

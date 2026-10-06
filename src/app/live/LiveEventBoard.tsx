"use client";

import Image from "next/image";
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
  const [justUpdated, setJustUpdated] = useState<Record<string, boolean>>({});
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
        setJustUpdated((prev) => ({ ...prev, [itemId]: true }));
        setTimeout(() => setJustUpdated((prev) => ({ ...prev, [itemId]: false })), 1500);

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
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_320px]">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
              justUpdated[item.id] ? "border-brand-purple ring-2 ring-brand-lavender/60" : "border-brand-lavender/50"
            }`}
          >
            <div className="relative h-44 w-full overflow-hidden bg-brand-lavender-tint">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-lavender/50 to-brand-purple/20">
                  <Image
                    src="/brand/paw-icon.png"
                    alt=""
                    width={96}
                    height={96}
                    className="absolute -bottom-4 -right-4 h-28 w-28 opacity-20"
                  />
                  <span className="relative text-xs font-semibold uppercase tracking-[0.2em] text-brand-purple-dark/70">
                    {item.category ?? item.itemType}
                  </span>
                </div>
              )}
              <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-purple-dark backdrop-blur-sm">
                {item.itemNumber}
              </div>
            </div>
            <div className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {item.category ?? item.itemType}
              </div>
              <div className="mt-0.5 line-clamp-2 text-lg font-bold leading-tight text-neutral-900">{item.title}</div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div
                    className={`text-4xl font-extrabold tracking-tight transition-colors duration-300 ${
                      justUpdated[item.id] ? "text-brand-purple" : "text-brand-purple-dark"
                    }`}
                  >
                    {money(item.currentAmountCents)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {item.bidCount} bid{item.bidCount === 1 ? "" : "s"}
                    {item.leadingBidderNumber !== null && <> · leading: #{item.leadingBidderNumber}</>}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.status === "OPEN"
                      ? "bg-green-100 text-green-700"
                      : item.status === "AWARDED"
                        ? "bg-brand-lavender/30 text-brand-purple-dark"
                        : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-neutral-500">Items open up as the night gets going — check back soon.</p>
        )}
      </div>

      <div className="rounded-2xl border border-brand-lavender/50 bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:self-start">
        <h2 className="font-semibold text-brand-purple-dark">Live activity</h2>
        <p className="mt-1 text-xs text-neutral-500">Updates the instant a bid lands, from anyone&rsquo;s phone.</p>
        <div className="mt-4 space-y-3">
          {activity.map((entry) => (
            <div key={entry.id} className="border-b border-neutral-100 pb-3 text-sm last:border-0">
              <span className="font-semibold text-brand-purple">#{entry.bidderNumber ?? "?"}</span>{" "}
              <span className="text-neutral-800">
                bid {money(entry.amountCents)} on {entry.itemTitle}
              </span>
              <div className="mt-0.5 text-xs text-neutral-400">
                {new Date(entry.serverTimestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {activity.length === 0 && <p className="text-sm text-neutral-500">No bids yet — this updates live.</p>}
        </div>
      </div>
    </div>
  );
}

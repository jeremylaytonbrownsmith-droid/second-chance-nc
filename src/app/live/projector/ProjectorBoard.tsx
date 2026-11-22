"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CloseCountdown } from "@/components/CloseCountdown";

interface ItemViewModel {
  id: string;
  itemNumber: string;
  title: string;
  category: string | null;
  itemType: string;
  image: string | null;
  fmvCents: number | null;
  status: string;
  closeAt: string | null;
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
}

interface BidUpdateEvent {
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
}

const ROTATE_MS = 8_000;

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Coming soon",
  OPEN: "Open for bidding",
  CLOSED: "Bidding closed",
  AWARDED: "Sold",
  UNSOLD: "Unsold",
};

/**
 * Event night item 14: projector mode. A kiosk screen, not a UI anyone
 * operates — no bid button, no nav, no admin controls, nothing to tap.
 * Auto-rotates through items on a timer, kept live the same way the
 * other live surfaces are (one SSE connection per item via
 * src/app/api/realtime/items/[itemId]).
 */
export function ProjectorBoard({
  eventName,
  totalRaisedCents,
  goalCents,
  items: initialItems,
}: {
  eventName: string;
  totalRaisedCents: number | null;
  goalCents: number | null;
  items: ItemViewModel[];
}) {
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const itemsRef = useRef(initialItems);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const sources = initialItems.map((item) => {
      const es = new EventSource(`/api/realtime/items/${item.id}`);
      const apply = (e: Event) => {
        const data = JSON.parse((e as MessageEvent).data) as BidUpdateEvent;
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  currentAmountCents: data.currentAmountCents,
                  leadingBidderNumber: data.leadingBidderNumber,
                  bidCount: data.bidCount,
                }
              : it,
          ),
        );
      };
      es.addEventListener("snapshot", apply);
      es.addEventListener("bid", apply);
      return es;
    });
    return () => sources.forEach((es) => es.close());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % itemsRef.current.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length]);

  const item = items[index] ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-lavender-tint to-white">
      <header className="flex items-center justify-between px-10 py-6">
        <Image
          src="/brand/second-chance-logo.png"
          alt="Second Chance Pet Adoptions"
          width={220}
          height={77}
          priority
          unoptimized
          className="h-12 w-auto"
        />
        <h1 className="text-3xl font-extrabold tracking-tight text-brand-purple-dark">{eventName}</h1>
      </header>

      {totalRaisedCents !== null && (
        <div className="px-10">
          <div className="rounded-2xl border border-brand-lavender/50 bg-white/80 p-6 shadow-sm">
            <p className="text-xl font-semibold uppercase tracking-[0.15em] text-brand-purple">
              Raised tonight
            </p>
            <p className="mt-1 text-7xl font-extrabold tracking-tight text-brand-purple-dark">
              {money(totalRaisedCents)}
              {goalCents !== null && (
                <span className="ml-4 text-3xl font-semibold text-neutral-500">
                  of {money(goalCents)} goal
                </span>
              )}
            </p>
            {goalCents !== null && (
              <div className="mt-4 h-6 overflow-hidden rounded-full bg-brand-lavender-tint">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-purple-dark transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(totalRaisedCents > 0 ? 3 : 0, (totalRaisedCents / goalCents) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center px-10 py-8">
        {item ? (
          <div
            key={item.id}
            className="grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-brand-lavender-tint shadow-xl">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-lavender/50 to-brand-purple/20">
                  <Image
                    src="/brand/paw-icon.png"
                    alt=""
                    width={200}
                    height={200}
                    className="h-40 w-40 opacity-30"
                  />
                </div>
              )}
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-1.5 text-lg font-bold uppercase tracking-wide text-brand-purple-dark">
                {item.itemNumber}
              </div>
            </div>

            <div>
              <div className="text-xl font-semibold uppercase tracking-wide text-neutral-500">
                {item.category ?? item.itemType}
              </div>
              <h2 className="mt-1 text-5xl font-extrabold leading-tight text-neutral-900">
                {item.title}
              </h2>
              {item.status === "OPEN" && item.closeAt && (
                <div className="mt-4 text-lg">
                  <CloseCountdown closeAt={item.closeAt} />
                </div>
              )}
              <div className="mt-8 text-8xl font-extrabold tracking-tight text-brand-purple-dark">
                {money(item.currentAmountCents)}
              </div>
              <div className="mt-3 text-2xl text-neutral-500">
                {item.bidCount} bid{item.bidCount === 1 ? "" : "s"}
                {item.leadingBidderNumber !== null && <> · leading: paddle #{item.leadingBidderNumber}</>}
              </div>
              <span
                className={`mt-6 inline-block rounded-full px-4 py-1.5 text-lg font-semibold ${
                  item.status === "OPEN"
                    ? "bg-green-100 text-green-800"
                    : item.status === "AWARDED"
                      ? "bg-brand-lavender/30 text-brand-purple-dark"
                      : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {STATUS_LABELS[item.status] ?? item.status}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-3xl text-neutral-500">Items open up as the night gets going.</p>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-2 pb-8">
          {items.map((it, i) => (
            <span
              key={it.id}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i === index ? "bg-brand-purple" : "bg-brand-lavender/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

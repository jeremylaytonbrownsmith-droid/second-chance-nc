"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface ItemViewModel {
  id: string;
  itemNumber: string;
  title: string;
  category: string | null;
  image: string | null;
  fmvCents: number | null;
  bidIncrementCents: number | null;
  buyNowCents: number | null;
  status: string;
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
}

interface BidUpdateEvent {
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
}

export function BidBoard({
  registrationId,
  bidderNumber,
  items: initialItems,
}: {
  registrationId: string;
  bidderNumber: number;
  items: ItemViewModel[];
}) {
  const [items, setItems] = useState(initialItems);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [maxBidOpenFor, setMaxBidOpenFor] = useState<string | null>(null);
  const [maxBidValue, setMaxBidValue] = useState("");

  // Item list is fixed for the lifetime of this page in the demo — one
  // SSE connection per item, closed on unmount.
  useEffect(() => {
    const applyUpdate = (itemId: string, data: BidUpdateEvent) => {
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
    };

    const sources = initialItems.map((item) => {
      const es = new EventSource(`/api/realtime/items/${item.id}`);
      es.addEventListener("snapshot", (e) => {
        applyUpdate(item.id, JSON.parse((e as MessageEvent).data));
      });
      es.addEventListener("bid", (e) => {
        applyUpdate(item.id, JSON.parse((e as MessageEvent).data));
      });
      return es;
    });

    return () => sources.forEach((es) => es.close());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function placeBid(item: ItemViewModel, amountCents: number, isMaxBid = false) {
    setPending((p) => ({ ...p, [item.id]: true }));
    setErrors((e) => ({ ...e, [item.id]: "" }));
    try {
      const res = await fetch("/api/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          registrationId,
          amountCents,
          source: "MOBILE",
          isMaxBid,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [item.id]: data.message ?? "Bid failed" }));
      } else if (isMaxBid) {
        setMaxBidOpenFor(null);
        setMaxBidValue("");
      }
    } catch {
      setErrors((e) => ({
        ...e,
        [item.id]: "Network error — venue wifi may be down. Try again.",
      }));
    } finally {
      setPending((p) => ({ ...p, [item.id]: false }));
    }
  }

  async function buyNow(item: ItemViewModel) {
    if (!window.confirm(`Buy "${item.title}" right now for $${((item.buyNowCents ?? 0) / 100).toFixed(2)}? This ends bidding immediately.`)) {
      return;
    }
    setPending((p) => ({ ...p, [item.id]: true }));
    setErrors((e) => ({ ...e, [item.id]: "" }));
    try {
      const res = await fetch("/api/bid/buy-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, registrationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [item.id]: data.message ?? "Buy it now failed" }));
      } else {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: "AWARDED", currentAmountCents: data.award.amountCents, leadingBidderNumber: bidderNumber }
              : it,
          ),
        );
      }
    } catch {
      setErrors((e) => ({ ...e, [item.id]: "Network error — venue wifi may be down. Try again." }));
    } finally {
      setPending((p) => ({ ...p, [item.id]: false }));
    }
  }

  const leadingItems = items.filter((it) => it.leadingBidderNumber === bidderNumber);
  const totalLeadingCents = leadingItems.reduce((sum, it) => sum + it.currentAmountCents, 0);
  const maxLeadingCents = Math.max(...leadingItems.map((it) => it.currentAmountCents), 1);

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="rounded-2xl border border-brand-lavender/50 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">You&apos;re committed to</p>
              <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-brand-purple-dark">
                ${(totalLeadingCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <p className="pb-1 text-right text-sm text-neutral-500">
              Leading {leadingItems.length} of {items.length} item{items.length === 1 ? "" : "s"}
            </p>
          </div>

          {leadingItems.length >= 2 && (
            <div className="mt-4 space-y-2.5">
              {leadingItems.map((it) => {
                const pct = Math.max(6, Math.round((it.currentAmountCents / maxLeadingCents) * 100));
                return (
                  <div key={it.id} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 truncate text-xs text-neutral-600">{it.title}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-brand-lavender-tint">
                      <div
                        className="h-full bg-brand-purple transition-all duration-500"
                        style={{ width: `${pct}%`, borderRadius: "0 4px 4px 0" }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs font-semibold text-brand-purple-dark">
                      ${(it.currentAmountCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {items.map((item) => {
        const increment = item.bidIncrementCents ?? 100;
        const nextBid = item.currentAmountCents + increment;
        const youAreLeading = item.leadingBidderNumber === bidderNumber;

        return (
          <div
            key={item.id}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow duration-200 ${
              youAreLeading ? "border-green-400 shadow-md shadow-green-100" : "border-brand-lavender/50"
            }`}
          >
            <div className="flex gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-lavender-tint">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-lavender/50 to-brand-purple/20">
                    <Image
                      src="/brand/paw-icon.png"
                      alt=""
                      width={40}
                      height={40}
                      className="h-9 w-9 opacity-40"
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  {item.itemNumber} {item.category ? `· ${item.category}` : ""}
                </div>
                <div className="truncate text-base font-bold leading-tight text-neutral-900">{item.title}</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  FMV {item.fmvCents !== null ? `$${(item.fmvCents / 100).toFixed(2)}` : "—"}
                </div>

                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-2xl font-extrabold tracking-tight text-brand-purple">
                      ${(item.currentAmountCents / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {item.bidCount} bid{item.bidCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  {youAreLeading && (
                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                      You&apos;re winning!
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-100 px-4 py-3">
              {item.status !== "OPEN" ? (
                <div className="text-sm text-neutral-500">
                  {item.status === "AWARDED" && youAreLeading ? "Sold to you! 🎉" : "Bidding closed."}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      disabled={pending[item.id]}
                      onClick={() => placeBid(item, nextBid)}
                      className="flex-1 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-brand-purple-dark hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending[item.id] ? "Placing bid…" : `Bid $${(nextBid / 100).toFixed(2)}`}
                    </button>
                    {item.buyNowCents && (
                      <button
                        disabled={pending[item.id]}
                        onClick={() => buyNow(item)}
                        className="shrink-0 rounded-lg border border-brand-purple px-3 py-2.5 text-sm font-semibold text-brand-purple transition-colors hover:bg-brand-lavender-tint disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Buy now ${(item.buyNowCents / 100).toFixed(0)}
                      </button>
                    )}
                  </div>

                  {maxBidOpenFor === item.id ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min={(nextBid / 100).toFixed(2)}
                        value={maxBidValue}
                        onChange={(e) => setMaxBidValue(e.target.value)}
                        placeholder={`Max $ (at least $${(nextBid / 100).toFixed(2)})`}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none"
                      />
                      <button
                        disabled={pending[item.id] || !maxBidValue}
                        onClick={() => placeBid(item, Math.round(Number(maxBidValue) * 100), true)}
                        className="shrink-0 rounded-lg bg-brand-purple-dark px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Set
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setMaxBidOpenFor(item.id)}
                      className="w-full text-center text-xs font-medium text-brand-purple hover:underline"
                    >
                      Set a max bid — we&apos;ll bid for you up to that amount
                    </button>
                  )}
                </div>
              )}

              {errors[item.id] && <div className="mt-2 text-sm text-red-600">{errors[item.id]}</div>}
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-sm text-neutral-500">No silent auction items open right now.</p>
      )}
    </div>
  );
}

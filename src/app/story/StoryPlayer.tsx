"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Bidder {
  registrationId: string;
  bidderNumber: number;
}

interface Props {
  eventId: string;
  eventName: string;
  orgId: string;
  lakeHouseItemId: string;
  artPieceItemNumber: string;
  bidders: Bidder[];
}

type PhaseKey =
  | "intro"
  | "bidding"
  | "hammer"
  | "checkout"
  | "import"
  | "sync"
  | "wrapup";

interface Phase {
  key: PhaseKey;
  time: string;
  title: string;
  caption: string;
  durationMs: number;
}

const PHASES: Phase[] = [
  {
    key: "intro",
    time: "6:00 PM",
    title: "Doors Open",
    caption:
      "Guests check in and browse the catalog on their own phones. Every item already has a fair market value on file — that's what makes everything downstream automatic.",
    durationMs: 6_000,
  },
  {
    key: "bidding",
    time: "6:45 PM",
    title: "Let the Auction Begin",
    caption:
      "Three guests are bidding on the Weekend at the Lake House from their own phones right now. Watch the price update live below — nobody refreshed anything.",
    durationMs: 15_000,
  },
  {
    key: "hammer",
    time: "7:30 PM",
    title: "Live Auction — the Hammer Falls",
    caption:
      "The Signed Local Artist Painting just sold at the live auction podium. One clerk entry — item number, paddle number, price — and it's recorded and awarded instantly.",
    durationMs: 6_000,
  },
  {
    key: "checkout",
    time: "9:00 PM",
    title: "Checkout",
    caption:
      "At the end of the night, this bidder's auction win, a fund-a-need gift, and a cash gift all get checked out together — one payment. The receipt below shows the real tax math computed live, not entered by hand.",
    durationMs: 10_000,
  },
  {
    key: "import",
    time: "Two Days Later",
    title: "Reconciling Last Year's Spreadsheet",
    caption:
      "This is the moment that matters most: a real spreadsheet, loaded in, with every row run through the same tax engine you just watched work.",
    durationMs: 9_000,
  },
  {
    key: "sync",
    time: "That Evening",
    title: "Syncing to the Donor CRM",
    caption:
      "Every completed gift — from tonight's checkout and from the spreadsheet import — queues to sync to the donor CRM automatically, with retries if anything fails.",
    durationMs: 8_000,
  },
  {
    key: "wrapup",
    time: "",
    title: "What You Just Saw",
    caption: "",
    durationMs: 0,
  },
];

const SAMPLE_CSV = `Donor Name,Donor Email,Line Type,Amount,FMV,Designation
Taylor Brooks,taylor.brooks@example.com,Auction Win,300,200,
Jordan Diaz,jordan.diaz@example.com,Fund a Need,500,,Emergency Vet Fund
Casey Park,casey.park@example.com,Raffle,20,,
`;

const BIDDING_LADDER = [
  { delayMs: 2_500, amountCents: 5_000, bidderIndex: 0 },
  { delayMs: 6_500, amountCents: 5_500, bidderIndex: 1 },
  { delayMs: 10_500, amountCents: 6_000, bidderIndex: 2 },
];

interface ImportSummary {
  totalRows: number;
  importedRows: number;
  donorsCreated: number;
  totalAmountCents: number;
  totalDeductibleCents: number;
}

export function StoryPlayer({
  eventId,
  eventName,
  orgId,
  lakeHouseItemId,
  artPieceItemNumber,
  bidders,
}: Props) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [hammerReady, setHammerReady] = useState(false);

  const enteredRef = useRef(new Set<PhaseKey>());
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phase = PHASES[phaseIndex];

  function clearScheduled() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
  }

  function goTo(index: number) {
    clearScheduled();
    setPhaseIndex(Math.max(0, Math.min(PHASES.length - 1, index)));
  }

  // Run each phase's one-time side effect against the real backend.
  useEffect(() => {
    if (enteredRef.current.has(phase.key)) return;
    enteredRef.current.add(phase.key);

    if (phase.key === "bidding") {
      BIDDING_LADDER.forEach(({ delayMs, amountCents, bidderIndex }) => {
        const t = setTimeout(() => {
          fetch("/api/bid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: lakeHouseItemId,
              registrationId: bidders[bidderIndex].registrationId,
              amountCents,
              source: "MOBILE",
            }),
          }).catch(() => {});
        }, delayMs);
        timeoutsRef.current.push(t);
      });
    }

    if (phase.key === "hammer") {
      (async () => {
        try {
          await fetch("/api/admin/clerk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              itemNumber: artPieceItemNumber,
              bidderNumber: bidders[0].bidderNumber,
              hammerPriceCents: 25_000, // above the $200 FMV, so the receipt shows a real deductible split rather than $0
              actorId: "Auctioneer",
            }),
          });
        } finally {
          // Item status (OPEN -> AWARDED) isn't part of the live SSE bid
          // payload, so the board needs a fresh load to show it rather
          // than relying on the stream to push it.
          setHammerReady(true);
        }
      })();
    }

    if (phase.key === "checkout") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheckoutPending(true);
      (async () => {
        try {
          const owedRes = await fetch(
            `/api/admin/checkout?registrationId=${bidders[0].registrationId}`,
          );
          const owed = await owedRes.json();
          const lines = [
            ...(owed.outstandingAwards ?? []).map(
              (a: { awardId: string; amountCents: number; fmvCents: number }) => ({
                lineType: "AUCTION_WIN",
                amountCents: a.amountCents,
                fmvCents: a.fmvCents,
                awardId: a.awardId,
              }),
            ),
            { lineType: "FUND_A_NEED", amountCents: 20_000 },
            { lineType: "CASH_GIFT", amountCents: 5_000 },
          ];
          const res = await fetch("/api/admin/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              registrationId: bidders[0].registrationId,
              lines,
              method: "CARD",
              actorId: "Checkout Volunteer",
            }),
          });
          const data = await res.json();
          if (res.ok) setTransactionId(data.transactionId);
        } finally {
          setCheckoutPending(false);
        }
      })();
    }

    if (phase.key === "import") {
      setImportPending(true);
      (async () => {
        try {
          const formData = new FormData();
          formData.append(
            "file",
            new File([SAMPLE_CSV], "prior-year-gifts.csv", { type: "text/csv" }),
          );
          formData.append("eventId", eventId);
          formData.append("orgId", orgId);
          formData.append("actorId", "Import Runner");
          const res = await fetch("/api/admin/import", { method: "POST", body: formData });
          const data = await res.json();
          if (res.ok) setImportSummary(data);
        } finally {
          setImportPending(false);
        }
      })();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.key]);

  // Auto-advance.
  useEffect(() => {
    if (!playing || phase.durationMs === 0) return;
    advanceTimerRef.current = setTimeout(() => {
      setPhaseIndex((i) => Math.min(PHASES.length - 1, i + 1));
    }, phase.durationMs);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [phase.key, playing, phase.durationMs]);

  useEffect(() => clearScheduled, []);

  // Keyboard controls for presenting with a clicker.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(phaseIndex + 1);
      if (e.key === "ArrowLeft") goTo(phaseIndex - 1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIndex]);

  const liveBoardUrl = `/admin/events/${eventId}/live`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
      <div className="flex items-center gap-1 px-4 pt-4 sm:px-8">
        {PHASES.map((p, i) => (
          <div
            key={p.key}
            className="h-1 flex-1 overflow-hidden rounded-full bg-white/15"
          >
            <div
              className={`h-full bg-brand-lavender transition-all ${
                i <= phaseIndex ? "w-full" : "w-0"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 pt-2 sm:px-8">
        <span className="text-xs uppercase tracking-wide text-white/50">
          {eventName} — Story Mode
        </span>
        <Link href="/admin" className="text-xs text-white/50 hover:text-white">
          Exit
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-4xl">
          {phase.time && (
            <div className="text-sm font-medium text-brand-lavender">{phase.time}</div>
          )}
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{phase.title}</h1>
          {phase.caption && (
            <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
              {phase.caption}
            </p>
          )}

          <div className="mt-6">
            {phase.key === "intro" && (
              <iframe
                title="Item catalog"
                src={`/admin/events/${eventId}`}
                className="h-[60vh] w-full rounded-lg border border-white/10 bg-white"
              />
            )}

            {phase.key === "bidding" && (
              <iframe
                key="live-board"
                title="Live auction board"
                src={liveBoardUrl}
                className="h-[60vh] w-full rounded-lg border border-white/10 bg-white"
              />
            )}

            {phase.key === "hammer" &&
              (!hammerReady ? (
                <StoryLoadingCard label="Recording the sale…" />
              ) : (
                <iframe
                  key="hammer-board"
                  title="Live auction board"
                  src={liveBoardUrl}
                  className="h-[60vh] w-full rounded-lg border border-white/10 bg-white"
                />
              ))}

            {phase.key === "checkout" &&
              (checkoutPending || !transactionId ? (
                <StoryLoadingCard label="Running checkout…" />
              ) : (
                <iframe
                  title="Receipt"
                  src={`/admin/receipts/${transactionId}`}
                  className="h-[60vh] w-full rounded-lg border border-white/10 bg-white"
                />
              ))}

            {phase.key === "import" &&
              (importPending || !importSummary ? (
                <StoryLoadingCard label="Importing prior year's spreadsheet…" />
              ) : (
                <div className="rounded-lg border border-white/10 bg-white p-6 text-neutral-900">
                  <h2 className="font-semibold">Import complete</h2>
                  <ul className="mt-3 space-y-1 text-sm">
                    <li>{importSummary.totalRows} rows found</li>
                    <li className="text-green-700">
                      {importSummary.importedRows} imported
                    </li>
                    <li>{importSummary.donorsCreated} new donors created</li>
                    <li>
                      Total paid: ${(importSummary.totalAmountCents / 100).toFixed(2)} —
                      total deductible: $
                      {(importSummary.totalDeductibleCents / 100).toFixed(2)}
                    </li>
                  </ul>
                  <p className="mt-3 text-xs text-neutral-500">
                    Same numbers you&rsquo;d get by hand — computed automatically, for
                    every row, in seconds.
                  </p>
                </div>
              ))}

            {phase.key === "sync" && (
              <iframe
                title="Sync log"
                src="/admin/sync-log"
                className="h-[60vh] w-full rounded-lg border border-white/10 bg-white"
              />
            )}

            {phase.key === "wrapup" && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6">
                <ul className="space-y-2 text-sm text-white/80">
                  <li>✓ Live bidding, updating on every device in real time</li>
                  <li>✓ A live-auction clerk screen fast enough for a ten-minute volunteer</li>
                  <li>✓ One checkout per bidder, with the tax math computed automatically</li>
                  <li>✓ A prior year&rsquo;s spreadsheet reconciled in seconds, not days</li>
                  <li>✓ Every gift queued to sync to the donor CRM</li>
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/admin"
                    className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark"
                  >
                    Explore it yourself
                  </Link>
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded border border-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Watch it again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-4">
        <button
          onClick={() => goTo(phaseIndex - 1)}
          disabled={phaseIndex === 0}
          className="rounded border border-white/20 px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
        >
          ← Back
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded bg-brand-purple px-5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => goTo(phaseIndex + 1)}
          disabled={phaseIndex === PHASES.length - 1}
          className="rounded border border-white/20 px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function StoryLoadingCard({ label }: { label: string }) {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center rounded-lg border border-white/10 bg-white/5">
      <div className="flex items-center gap-3 text-white/70">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        {label}
      </div>
    </div>
  );
}

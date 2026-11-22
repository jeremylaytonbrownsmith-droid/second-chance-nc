/**
 * Shared label/badge helpers for the admin UI — humanized enum labels
 * and colored status pills, so every screen that shows an item type or
 * status renders it the same way instead of a bare raw enum string.
 */

export const ITEM_TYPE_LABELS: Record<string, string> = {
  SILENT: "Silent",
  LIVE: "Live",
  RAFFLE: "Raffle",
  FIXED_PRICE: "Fixed price",
  FUND_A_NEED: "Fund a Need",
};

export function itemTypeLabel(itemType: string): string {
  return ITEM_TYPE_LABELS[itemType] ?? itemType;
}

// FMV only means something for a line type whose deductible is
// amount-minus-FMV (AUCTION_WIN/TICKET/SPONSORSHIP/MERCH) — a raffle
// ticket is never deductible and a fund-a-need gift is always fully
// deductible, so FMV never enters either calculation. See the
// deductible table in CLAUDE.md / src/lib/money/deductible.ts.
const ITEM_TYPES_WITHOUT_FMV = new Set(["RAFFLE", "FUND_A_NEED"]);

export function formatFmvForItemType(itemType: string, fmvCents: number | null): string {
  if (ITEM_TYPES_WITHOUT_FMV.has(itemType)) return "N/A";
  if (fmvCents === null) return "—";
  return `$${(fmvCents / 100).toFixed(2)}`;
}

const ITEM_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  OPEN: "bg-green-100 text-green-800",
  CLOSED: "bg-neutral-100 text-neutral-600",
  AWARDED: "bg-brand-lavender/30 text-brand-purple-dark",
  UNSOLD: "bg-amber-100 text-amber-800",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  AWARDED: "Sold",
  UNSOLD: "Unsold",
};

export function ItemStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        ITEM_STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600"
      }`}
    >
      {ITEM_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Form8283NeededBadge({ needed }: { needed: boolean }) {
  return needed ? (
    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Needed
    </span>
  ) : (
    <span className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
      Not needed
    </span>
  );
}

const REGISTRATION_STATUS_DOTS: Record<string, string> = {
  REGISTERED: "bg-amber-500",
  CHECKED_IN: "bg-green-500",
  CHECKED_OUT: "bg-neutral-400",
  CANCELLED: "bg-red-500",
};

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
};

/** A small colored dot + label distinguishing a bidder's registration
 * state — mainly "Registered" (signed up, hasn't arrived yet) from
 * "Checked in" (physically at the event, has a paddle number). */
export function RegistrationStatusDot({ status }: { status: string | null }) {
  if (!status) return <span className="text-neutral-500">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${REGISTRATION_STATUS_DOTS[status] ?? "bg-neutral-400"}`} />
      {REGISTRATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Form8283ReceivedBadge({ receivedAt }: { receivedAt: Date | null }) {
  if (receivedAt) {
    return (
      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Received {receivedAt.toISOString().slice(0, 10)}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
      Pending
    </span>
  );
}

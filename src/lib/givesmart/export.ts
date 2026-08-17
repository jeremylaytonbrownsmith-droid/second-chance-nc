import { toCsv, type CsvColumn } from "@/lib/csv/to-csv";
import type { AuctionItem } from "@prisma/client";

/**
 * GiveSmart sync target adapter (same pattern as eTapestry — see
 * src/lib/etapestry/adapter.ts and CLAUDE.md rule 6: our schema is the
 * source of truth, external platforms are sync targets behind an
 * adapter). Staff currently re-type the whole catalog into GiveSmart by
 * hand, matching item numbers so bidding results tie back correctly —
 * this replaces that with one CSV they upload through GiveSmart's own
 * item-import tool.
 *
 * IMPORTANT: no public GiveSmart API for pushing items in was found while
 * building this — only their own CSV item-import template, whose exact
 * column names/order aren't published anywhere confirmable from outside
 * an account. These headers are a reasonable, clearly-labeled best guess
 * built from common auction-item-import conventions. Check them against
 * Manage > Items > Import in the org's real GiveSmart account before
 * relying on this, and adjust the column list below to match.
 */

export interface GiveSmartExportRow {
  item: AuctionItem;
  donorName: string | null;
}

function money(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

const GIVESMART_COLUMNS: CsvColumn<GiveSmartExportRow>[] = [
  { header: "Item Number", value: (r) => r.item.itemNumber },
  { header: "Item Name", value: (r) => r.item.title },
  { header: "Description", value: (r) => r.item.description },
  { header: "Category", value: (r) => r.item.category },
  { header: "Fair Market Value", value: (r) => money(r.item.fmvCents) },
  { header: "Starting Bid", value: (r) => money(r.item.startingBidCents) },
  { header: "Buy Now Price", value: (r) => money(r.item.buyNowCents) },
  { header: "Quantity", value: (r) => r.item.quantity },
  { header: "Donated By", value: (r) => r.donorName },
];

export function buildGiveSmartCsv(rows: GiveSmartExportRow[]): string {
  return toCsv(rows, GIVESMART_COLUMNS);
}

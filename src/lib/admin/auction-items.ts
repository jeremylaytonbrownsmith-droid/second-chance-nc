import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditedMutation } from "@/lib/audit";
import { assertItemCanOpenForBidding } from "@/lib/money/substantiation";
import type { CsvColumn } from "@/lib/csv/to-csv";
import type { AuctionItem } from "@prisma/client";
import { AuctionItemStatus } from "@prisma/client";

export const createAuctionItemSchema = z.object({
  eventId: z.string().min(1),
  itemNumber: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
  itemType: z.enum(["SILENT", "LIVE", "RAFFLE", "FIXED_PRICE", "FUND_A_NEED"]),
  fmvCents: z.number().int().min(0).optional(),
  fmvBasis: z.string().trim().optional(),
  startingBidCents: z.number().int().min(0).optional(),
  bidIncrementCents: z.number().int().min(0).optional(),
  buyNowCents: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).default(1),
  itemDonorId: z.string().min(1).optional(),
});

export type CreateAuctionItemInput = z.input<typeof createAuctionItemSchema>;

export interface AuctionItemFilters {
  category?: string;
  search?: string;
}

export async function listAuctionItems(
  eventId: string,
  filters: AuctionItemFilters = {},
): Promise<AuctionItem[]> {
  return prisma.auctionItem.findMany({
    where: {
      eventId,
      voidedAt: null,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
              { itemNumber: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { itemNumber: "asc" },
  });
}

export async function listAuctionItemCategories(eventId: string): Promise<string[]> {
  const rows = await prisma.auctionItem.findMany({
    where: { eventId, voidedAt: null, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category).filter((c): c is string => Boolean(c));
}

export async function createAuctionItem(
  input: CreateAuctionItemInput,
): Promise<AuctionItem> {
  const data = createAuctionItemSchema.parse(input);
  return prisma.auctionItem.create({
    data: { ...data, status: AuctionItemStatus.DRAFT },
  });
}

export async function updateAuctionItemFmv(
  id: string,
  fmvCents: number,
  fmvBasis: string,
  actorId: string,
): Promise<AuctionItem> {
  return auditedMutation({
    actorId,
    entityType: "AuctionItem",
    entityId: id,
    action: "update_fmv",
    before: (tx) => tx.auctionItem.findUniqueOrThrow({ where: { id } }),
    mutate: (tx) =>
      tx.auctionItem.update({ where: { id }, data: { fmvCents, fmvBasis } }),
    after: async (_tx, result) => result,
  });
}

/**
 * CLAUDE.md rule 1 / Section 5 rule 1: FMV is required before an item can
 * open for bidding. Enforced here, not just in the UI, so no code path can
 * skip it.
 */
export async function openAuctionItemForBidding(
  id: string,
  actorId: string,
): Promise<AuctionItem> {
  return auditedMutation({
    actorId,
    entityType: "AuctionItem",
    entityId: id,
    action: "open",
    before: (tx) => tx.auctionItem.findUniqueOrThrow({ where: { id } }),
    mutate: async (tx) => {
      const item = await tx.auctionItem.findUniqueOrThrow({ where: { id } });
      assertItemCanOpenForBidding(item);
      return tx.auctionItem.update({
        where: { id },
        data: { status: AuctionItemStatus.OPEN },
      });
    },
    after: async (_tx, result) => result,
  });
}

export async function closeAuctionItem(
  id: string,
  actorId: string,
): Promise<AuctionItem> {
  return auditedMutation({
    actorId,
    entityType: "AuctionItem",
    entityId: id,
    action: "close",
    before: (tx) => tx.auctionItem.findUniqueOrThrow({ where: { id } }),
    mutate: (tx) =>
      tx.auctionItem.update({
        where: { id },
        data: { status: AuctionItemStatus.CLOSED },
      }),
    after: async (_tx, result) => result,
  });
}

export async function voidAuctionItem(
  id: string,
  reason: string,
): Promise<AuctionItem> {
  return prisma.auctionItem.update({
    where: { id },
    data: { voidedAt: new Date(), voidReason: reason },
  });
}

/**
 * Staggered close (Event night, item 11): set one close time for every
 * item in a category at once, rather than one item at a time — the whole
 * point of staggering is that different categories lock at different,
 * pre-planned times instead of everything closing simultaneously.
 * Doesn't touch item status directly; closeExpiredItemsForEvent (below)
 * is what actually flips OPEN -> CLOSED once that time arrives.
 */
export async function setCategoryCloseTime(
  eventId: string,
  category: string,
  closeAt: Date,
  actorId: string,
): Promise<{ count: number }> {
  return auditedMutation({
    actorId,
    entityType: "AuctionItem",
    entityId: `category:${category}`,
    action: "set_category_close_time",
    before: async () => null,
    mutate: (tx) =>
      tx.auctionItem.updateMany({
        where: { eventId, category, voidedAt: null },
        data: { closeAt },
      }),
    after: async (_tx, result) => result,
  });
}

/**
 * Lazy sweep: any OPEN item whose closeAt has passed gets flipped to
 * CLOSED. No background job scheduler exists in this app, so this runs
 * opportunistically at the top of every page that lists an event's
 * items (the live board, the bidder view, the admin catalog) — cheap
 * (one indexed bulk UPDATE) and keeps what's displayed honest even if no
 * one has bid on or looked at a given item since its close time passed.
 * placeBid (src/lib/auction/bidding.ts) also re-checks closeAt itself as
 * a last-moment guard, in case a bid slips in between sweeps.
 */
export async function closeExpiredItemsForEvent(eventId: string): Promise<void> {
  await prisma.auctionItem.updateMany({
    where: { eventId, status: AuctionItemStatus.OPEN, closeAt: { lte: new Date() } },
    data: { status: AuctionItemStatus.CLOSED },
  });
}

export const auctionItemCsvColumns: CsvColumn<AuctionItem>[] = [
  { header: "ID", value: (i) => i.id },
  { header: "Event ID", value: (i) => i.eventId },
  { header: "Item Number", value: (i) => i.itemNumber },
  { header: "Title", value: (i) => i.title },
  { header: "Category", value: (i) => i.category },
  { header: "Item Type", value: (i) => i.itemType },
  { header: "FMV (cents)", value: (i) => i.fmvCents },
  { header: "FMV Basis", value: (i) => i.fmvBasis },
  { header: "Starting Bid (cents)", value: (i) => i.startingBidCents },
  { header: "Buy Now (cents)", value: (i) => i.buyNowCents },
  { header: "Quantity", value: (i) => i.quantity },
  { header: "Status", value: (i) => i.status },
  { header: "Voided At", value: (i) => i.voidedAt },
];

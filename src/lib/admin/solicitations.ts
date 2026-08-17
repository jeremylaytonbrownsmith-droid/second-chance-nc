import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditedMutation } from "@/lib/audit";
import type { CsvColumn } from "@/lib/csv/to-csv";
import { AuctionItemStatus, SolicitationStatus, type Solicitation } from "@prisma/client";

/**
 * The "who have we asked, what have we gotten" list that exists before an
 * item is ever donated (staff feedback: "search by what's been solicited
 * and by category"). Deliberately separate from ItemDonor/AuctionItem —
 * most asks never convert, and a prospect isn't a real donor or a real
 * catalog item until one does.
 */

export const createSolicitationSchema = z.object({
  eventId: z.string().min(1),
  contactName: z.string().trim().min(1),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  estimatedValueCents: z.number().int().min(0).optional(),
  status: z.enum(SolicitationStatus).default(SolicitationStatus.CONTACTED),
  deliveryMethod: z.enum(["MAIL", "PICKUP", "DROPOFF", "DIGITAL"]).optional(),
  assignedTo: z.string().trim().min(1).optional(),
  lastContactedAt: z.coerce.date().optional(),
  priorYearDonor: z.boolean().default(false),
});

export type CreateSolicitationInput = z.input<typeof createSolicitationSchema>;

export interface SolicitationFilters {
  status?: SolicitationStatus;
  category?: string;
  search?: string;
}

function solicitationWhere(eventId: string, filters: SolicitationFilters) {
  return {
    eventId,
    voidedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    // Category is stored as free text, often several comma-separated
    // tags (real data: "Lodging, Mountains") — match on any one of them
    // rather than requiring an exact full-string match.
    ...(filters.category ? { category: { contains: filters.category, mode: "insensitive" as const } } : {}),
    ...(filters.search
      ? {
          OR: [
            { contactName: { contains: filters.search, mode: "insensitive" as const } },
            { contactEmail: { contains: filters.search, mode: "insensitive" as const } },
            { notes: { contains: filters.search, mode: "insensitive" as const } },
            { assignedTo: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export const SOLICITATIONS_PAGE_SIZE = 50;

export interface SolicitationPage {
  solicitations: Solicitation[];
  total: number;
  page: number;
  pageCount: number;
}

// Real usage is thousands of rows (a multi-year outreach list, not a
// short seed list) — this always paginates rather than returning
// everything, or the admin page would try to render it all in one shot.
export async function listSolicitations(
  eventId: string,
  filters: SolicitationFilters = {},
  page = 1,
): Promise<SolicitationPage> {
  const where = solicitationWhere(eventId, filters);
  const safePage = Math.max(1, page);
  const [solicitations, total] = await Promise.all([
    prisma.solicitation.findMany({
      where,
      orderBy: [{ status: "asc" }, { contactName: "asc" }],
      skip: (safePage - 1) * SOLICITATIONS_PAGE_SIZE,
      take: SOLICITATIONS_PAGE_SIZE,
    }),
    prisma.solicitation.count({ where }),
  ]);
  return {
    solicitations,
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / SOLICITATIONS_PAGE_SIZE)),
  };
}

/** Unpaginated — for CSV export only, never for rendering a page of UI. */
export async function listAllSolicitationsForExport(
  eventId: string,
  filters: SolicitationFilters = {},
): Promise<Solicitation[]> {
  return prisma.solicitation.findMany({
    where: solicitationWhere(eventId, filters),
    orderBy: [{ status: "asc" }, { contactName: "asc" }],
  });
}

export async function listSolicitationCategories(eventId: string): Promise<string[]> {
  const rows = await prisma.solicitation.findMany({
    where: { eventId, voidedAt: null, category: { not: null } },
    select: { category: true },
  });
  const tags = new Set<string>();
  for (const row of rows) {
    if (!row.category) continue;
    for (const tag of row.category.split(",")) {
      const trimmed = tag.trim();
      if (trimmed) tags.add(trimmed);
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

export async function createSolicitation(
  input: CreateSolicitationInput,
): Promise<Solicitation> {
  const data = createSolicitationSchema.parse(input);
  const { contactEmail, ...rest } = data;
  return prisma.solicitation.create({
    data: { ...rest, contactEmail: contactEmail === "" ? undefined : contactEmail },
  });
}

// DONATED is deliberately excluded here — it's only ever set by
// logDonation, which also creates the ItemDonor/AuctionItem it links to.
// Setting it through this path would leave that link dangling.
export async function setSolicitationStatus(
  id: string,
  status: Exclude<SolicitationStatus, "DONATED">,
): Promise<Solicitation> {
  return prisma.solicitation.update({ where: { id }, data: { status } });
}

export async function voidSolicitation(id: string, reason: string): Promise<Solicitation> {
  return prisma.solicitation.update({
    where: { id },
    data: { voidedAt: new Date(), voidReason: reason },
  });
}

// --- Donation intake: turning a solicitation (or a walk-in donation with
// no prior ask) into a real ItemDonor + AuctionItem in one step ----------

const donorInputSchema = z.object({
  constituentId: z.string().min(1).optional(),
  isBusiness: z.boolean().default(false),
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().min(1).optional(),
});

export const logDonationSchema = z.object({
  eventId: z.string().min(1),
  orgId: z.string().min(1),
  solicitationId: z.string().min(1).optional(),
  donor: donorInputSchema,
  itemNumber: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
  itemType: z.enum(["SILENT", "LIVE", "RAFFLE", "FIXED_PRICE", "FUND_A_NEED"]).default("SILENT"),
  estimatedValueCents: z.number().int().min(0),
  images: z.array(z.string()).max(4).default([]),
  actorId: z.string().trim().min(1),
});

export type LogDonationInput = z.input<typeof logDonationSchema>;

export interface LogDonationResult {
  auctionItemId: string;
  itemDonorId: string;
  constituentId: string;
}

/**
 * The "expense app" flow from staff feedback: photo + description + value
 * + category, in one submit. Creates (or reuses) the donor, the ItemDonor
 * record that drives the 8283 threshold, and the catalog item itself —
 * and if this came from a Solicitation, marks it DONATED and links it.
 */
export async function logDonation(input: LogDonationInput): Promise<LogDonationResult> {
  const data = logDonationSchema.parse(input);
  const auctionItemId = randomUUID();
  const itemDonorId = randomUUID();

  return auditedMutation({
    actorId: data.actorId,
    entityType: "AuctionItem",
    entityId: auctionItemId,
    action: "log_donation_intake",
    before: async () => null,
    mutate: async (tx) => {
      let constituent = data.donor.constituentId
        ? await tx.constituent.findUniqueOrThrow({ where: { id: data.donor.constituentId } })
        : null;

      if (!constituent) {
        const email = data.donor.email === "" ? undefined : data.donor.email;
        if (email) {
          constituent = await tx.constituent.findFirst({
            where: { orgId: data.orgId, email, voidedAt: null },
          });
        }
        if (!constituent) {
          const [firstName, ...rest] = (data.donor.name ?? "Unknown donor").split(" ");
          constituent = await tx.constituent.create({
            data: data.donor.isBusiness
              ? { orgId: data.orgId, isBusiness: true, orgName: data.donor.name, email, phone: data.donor.phone }
              : {
                  orgId: data.orgId,
                  firstName,
                  lastName: rest.join(" ") || undefined,
                  email,
                  phone: data.donor.phone,
                },
          });
        }
      }

      const itemDonor = await tx.itemDonor.create({
        data: {
          id: itemDonorId,
          eventId: data.eventId,
          constituentId: constituent.id,
          claimedValueCents: data.estimatedValueCents,
          substantiationNeeded: data.estimatedValueCents > 50_000,
        },
      });

      const auctionItem = await tx.auctionItem.create({
        data: {
          id: auctionItemId,
          eventId: data.eventId,
          itemNumber: data.itemNumber,
          title: data.title,
          description: data.description,
          category: data.category,
          itemType: data.itemType,
          fmvCents: data.estimatedValueCents,
          fmvBasis: "Estimated at donation intake — confirm before opening for bidding",
          images: data.images,
          itemDonorId: itemDonor.id,
          status: AuctionItemStatus.DRAFT,
        },
      });

      if (data.solicitationId) {
        await tx.solicitation.update({
          where: { id: data.solicitationId },
          data: {
            status: SolicitationStatus.DONATED,
            fulfilledAuctionItemId: auctionItem.id,
            estimatedValueCents: data.estimatedValueCents,
          },
        });
      }

      return { auctionItemId: auctionItem.id, itemDonorId: itemDonor.id, constituentId: constituent.id };
    },
    after: async (_tx, result) => result,
  });
}

export const solicitationCsvColumns: CsvColumn<Solicitation>[] = [
  { header: "ID", value: (s) => s.id },
  { header: "Contact Name", value: (s) => s.contactName },
  { header: "Contact Email", value: (s) => s.contactEmail },
  { header: "Contact Phone", value: (s) => s.contactPhone },
  { header: "Category", value: (s) => s.category },
  { header: "Status", value: (s) => s.status },
  { header: "Delivery Method", value: (s) => s.deliveryMethod },
  { header: "Assigned To", value: (s) => s.assignedTo },
  { header: "Last Contacted", value: (s) => s.lastContactedAt },
  { header: "Prior Year Donor", value: (s) => s.priorYearDonor },
  { header: "Estimated Value (cents)", value: (s) => s.estimatedValueCents },
  { header: "Notes", value: (s) => s.notes },
  { header: "Created At", value: (s) => s.createdAt },
];

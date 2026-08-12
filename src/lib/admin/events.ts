import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { CsvColumn } from "@/lib/csv/to-csv";
import type { Event } from "@prisma/client";
import { EventStatus } from "@prisma/client";

export const createEventSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required"),
  eventDate: z.coerce.date(),
  taxYear: z.number().int().min(2000).max(2100),
  silentCloseAt: z.coerce.date().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export async function listEvents(orgId?: string): Promise<Event[]> {
  return prisma.event.findMany({
    where: { voidedAt: null, ...(orgId ? { orgId } : {}) },
    orderBy: { eventDate: "desc" },
  });
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const data = createEventSchema.parse(input);
  return prisma.event.create({ data: { ...data, status: EventStatus.DRAFT } });
}

export async function setEventStatus(
  id: string,
  status: EventStatus,
): Promise<Event> {
  return prisma.event.update({ where: { id }, data: { status } });
}

export async function voidEvent(id: string, reason: string): Promise<Event> {
  return prisma.event.update({
    where: { id },
    data: { voidedAt: new Date(), voidReason: reason },
  });
}

export const eventCsvColumns: CsvColumn<Event>[] = [
  { header: "ID", value: (e) => e.id },
  { header: "Org ID", value: (e) => e.orgId },
  { header: "Name", value: (e) => e.name },
  { header: "Event Date", value: (e) => e.eventDate },
  { header: "Tax Year", value: (e) => e.taxYear },
  { header: "Status", value: (e) => e.status },
  { header: "Silent Close At", value: (e) => e.silentCloseAt },
  { header: "Voided At", value: (e) => e.voidedAt },
];

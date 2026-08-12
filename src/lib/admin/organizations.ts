import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { CsvColumn } from "@/lib/csv/to-csv";
import type { Organization } from "@prisma/client";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  ein: z.string().trim().min(1).optional(),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
});

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;

export async function listOrganizations(): Promise<Organization[]> {
  return prisma.organization.findMany({
    where: { voidedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<Organization> {
  const data = createOrganizationSchema.parse(input);
  return prisma.organization.create({ data });
}

export async function voidOrganization(
  id: string,
  reason: string,
): Promise<Organization> {
  return prisma.organization.update({
    where: { id },
    data: { voidedAt: new Date(), voidReason: reason },
  });
}

export const organizationCsvColumns: CsvColumn<Organization>[] = [
  { header: "ID", value: (o) => o.id },
  { header: "Name", value: (o) => o.name },
  { header: "EIN", value: (o) => o.ein },
  { header: "Fiscal Year Start (month)", value: (o) => o.fiscalYearStart },
  { header: "Created At", value: (o) => o.createdAt },
  { header: "Voided At", value: (o) => o.voidedAt },
];

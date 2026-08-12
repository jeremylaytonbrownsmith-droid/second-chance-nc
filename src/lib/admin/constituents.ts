import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { CsvColumn } from "@/lib/csv/to-csv";
import type { Constituent } from "@prisma/client";

const baseConstituentSchema = z.object({
  orgId: z.string().min(1),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  orgName: z.string().trim().min(1).optional(),
  isBusiness: z.boolean().default(false),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().min(1).optional(),
  address1: z.string().trim().min(1).optional(),
  address2: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  postalCode: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
});

export const createConstituentSchema = baseConstituentSchema.superRefine(
  (data, ctx) => {
    if (data.isBusiness && !data.orgName) {
      ctx.addIssue({
        code: "custom",
        message: "Business donors require an orgName",
        path: ["orgName"],
      });
    }
    if (!data.isBusiness && !data.firstName && !data.lastName) {
      ctx.addIssue({
        code: "custom",
        message: "Individual donors require a first or last name",
        path: ["firstName"],
      });
    }
  },
);

export type CreateConstituentInput = z.input<typeof baseConstituentSchema>;

export async function listConstituents(
  orgId: string,
  search?: string,
): Promise<Constituent[]> {
  return prisma.constituent.findMany({
    where: {
      orgId,
      voidedAt: null,
      mergedIntoId: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { orgName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function createConstituent(
  input: CreateConstituentInput,
): Promise<Constituent> {
  const data = createConstituentSchema.parse(input);
  const { email, ...rest } = data;
  return prisma.constituent.create({
    data: { ...rest, email: email === "" ? undefined : email },
  });
}

export async function mergeConstituents(
  sourceId: string,
  targetId: string,
): Promise<Constituent> {
  if (sourceId === targetId) {
    throw new Error("Cannot merge a constituent into itself");
  }
  return prisma.constituent.update({
    where: { id: sourceId },
    data: { mergedIntoId: targetId },
  });
}

export async function voidConstituent(
  id: string,
  reason: string,
): Promise<Constituent> {
  return prisma.constituent.update({
    where: { id },
    data: { voidedAt: new Date(), voidReason: reason },
  });
}

export const constituentCsvColumns: CsvColumn<Constituent>[] = [
  { header: "ID", value: (c) => c.id },
  { header: "First Name", value: (c) => c.firstName },
  { header: "Last Name", value: (c) => c.lastName },
  { header: "Org Name", value: (c) => c.orgName },
  { header: "Is Business", value: (c) => c.isBusiness },
  { header: "Email", value: (c) => c.email },
  { header: "Phone", value: (c) => c.phone },
  { header: "City", value: (c) => c.city },
  { header: "State", value: (c) => c.state },
  { header: "eTapestry Account Ref", value: (c) => c.etapestryAccountRef },
  { header: "Created At", value: (c) => c.createdAt },
  { header: "Voided At", value: (c) => c.voidedAt },
];

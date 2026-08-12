"use server";

import { revalidatePath } from "next/cache";
import { createOrganization } from "@/lib/admin/organizations";
import { createEvent } from "@/lib/admin/events";
import { createConstituent } from "@/lib/admin/constituents";
import { createItemDonor } from "@/lib/admin/item-donors";
import {
  closeAuctionItem,
  createAuctionItem,
  openAuctionItemForBidding,
  updateAuctionItemFmv,
  type CreateAuctionItemInput,
} from "@/lib/admin/auction-items";
import { syncTransactionToEtapestry } from "@/lib/etapestry/demo-sync";
import { resetDemoData } from "@/lib/demo/seed";

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function cents(formData: FormData, key: string): number | undefined {
  const value = str(formData, key);
  if (value === undefined) return undefined;
  return Math.round(Number(value) * 100);
}

export async function createOrganizationAction(formData: FormData) {
  await createOrganization({
    name: String(formData.get("name")),
    ein: str(formData, "ein"),
    fiscalYearStart: Number(formData.get("fiscalYearStart") ?? 1),
  });
  revalidatePath("/admin");
}

export async function createEventAction(formData: FormData) {
  await createEvent({
    orgId: String(formData.get("orgId")),
    name: String(formData.get("name")),
    eventDate: new Date(String(formData.get("eventDate"))),
    taxYear: Number(formData.get("taxYear")),
  });
  revalidatePath("/admin");
}

export async function createConstituentAction(formData: FormData) {
  const isBusiness = formData.get("isBusiness") === "on";
  const eventId = String(formData.get("eventId"));
  await createConstituent({
    orgId: String(formData.get("orgId")),
    isBusiness,
    firstName: str(formData, "firstName"),
    lastName: str(formData, "lastName"),
    orgName: str(formData, "orgName"),
    email: str(formData, "email") ?? "",
    phone: str(formData, "phone"),
  });
  revalidatePath(`/admin/events/${eventId}`);
}

export async function createItemDonorAction(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  await createItemDonor(
    {
      eventId,
      constituentId: String(formData.get("constituentId")),
      claimedValueCents: cents(formData, "claimedValueDollars") ?? 0,
    },
    String(formData.get("actorId")),
  );
  revalidatePath(`/admin/events/${eventId}`);
}

export async function createAuctionItemAction(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  const itemDonorId = str(formData, "itemDonorId");
  await createAuctionItem({
    eventId,
    itemNumber: String(formData.get("itemNumber")),
    title: String(formData.get("title")),
    description: str(formData, "description"),
    itemType: String(formData.get("itemType")) as CreateAuctionItemInput["itemType"],
    fmvCents: cents(formData, "fmvDollars"),
    fmvBasis: str(formData, "fmvBasis"),
    startingBidCents: cents(formData, "startingBidDollars"),
    buyNowCents: cents(formData, "buyNowDollars"),
    itemDonorId,
  });
  revalidatePath(`/admin/events/${eventId}`);
}

export async function setAuctionItemFmvAction(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  await updateAuctionItemFmv(
    String(formData.get("itemId")),
    cents(formData, "fmvDollars") ?? 0,
    String(formData.get("fmvBasis")),
    String(formData.get("actorId")),
  );
  revalidatePath(`/admin/events/${eventId}`);
}

export async function openAuctionItemAction(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  await openAuctionItemForBidding(
    String(formData.get("itemId")),
    String(formData.get("actorId")),
  );
  revalidatePath(`/admin/events/${eventId}`);
}

export async function closeAuctionItemAction(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  await closeAuctionItem(
    String(formData.get("itemId")),
    String(formData.get("actorId")),
  );
  revalidatePath(`/admin/events/${eventId}`);
}

export async function retrySyncAction(formData: FormData) {
  await syncTransactionToEtapestry(String(formData.get("transactionId")));
  revalidatePath("/admin/sync-log");
}

export async function resetDemoDataAction() {
  const { event } = await resetDemoData();
  revalidatePath("/admin");
  revalidatePath(`/admin/events/${event.id}`);
  revalidatePath("/admin/sync-log");
}

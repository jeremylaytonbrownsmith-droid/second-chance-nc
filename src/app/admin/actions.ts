"use server";

import { revalidatePath } from "next/cache";
import { createOrganization } from "@/lib/admin/organizations";
import { createEvent } from "@/lib/admin/events";
import { createConstituent, mergeConstituents } from "@/lib/admin/constituents";
import { createItemDonor } from "@/lib/admin/item-donors";
import {
  closeAuctionItem,
  createAuctionItem,
  openAuctionItemForBidding,
  setCategoryCloseTime,
  updateAuctionItemFmv,
  type CreateAuctionItemInput,
} from "@/lib/admin/auction-items";
import { syncTransactionToEtapestry } from "@/lib/etapestry/demo-sync";
import { resetDemoData } from "@/lib/demo/seed";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { createSolicitation, setSolicitationStatus } from "@/lib/admin/solicitations";
import { requireAdminRole } from "@/lib/admin/session";
import { runAction, type ActionState } from "@/lib/action-state";
import type { SolicitationStatus } from "@prisma/client";

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function cents(formData: FormData, key: string): number | undefined {
  const value = str(formData, key);
  if (value === undefined) return undefined;
  return Math.round(Number(value) * 100);
}

export async function createOrganizationAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    await requireAdminRole();
    await createOrganization({
      name: String(formData.get("name")),
      ein: str(formData, "ein"),
      fiscalYearStart: Number(formData.get("fiscalYearStart") ?? 1),
    });
    revalidatePath("/admin");
    return "Organization added.";
  });
}

export async function createEventAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    await requireAdminRole();
    await createEvent({
      orgId: String(formData.get("orgId")),
      name: String(formData.get("name")),
      eventDate: new Date(String(formData.get("eventDate"))),
      taxYear: Number(formData.get("taxYear")),
    });
    revalidatePath("/admin");
    return "Event added.";
  });
}

export async function createConstituentAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    await requireAdminRole();
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
    return "Constituent added.";
  });
}

export async function createItemDonorAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actorId = await requireAdminRole();
    const eventId = String(formData.get("eventId"));
    await createItemDonor(
      {
        eventId,
        constituentId: String(formData.get("constituentId")),
        claimedValueCents: cents(formData, "claimedValueDollars") ?? 0,
      },
      actorId,
    );
    revalidatePath(`/admin/events/${eventId}`);
    return "Item donor added.";
  });
}

export async function createAuctionItemAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    await requireAdminRole();
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
    return "Item added.";
  });
}

export async function setAuctionItemFmvAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actorId = await requireAdminRole();
    const eventId = String(formData.get("eventId"));
    await updateAuctionItemFmv(
      String(formData.get("itemId")),
      cents(formData, "fmvDollars") ?? 0,
      String(formData.get("fmvBasis")),
      actorId,
    );
    revalidatePath(`/admin/events/${eventId}`);
    return "FMV set.";
  });
}

export async function openAuctionItemAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actorId = await requireAdminRole();
    const eventId = String(formData.get("eventId"));
    await openAuctionItemForBidding(String(formData.get("itemId")), actorId);
    revalidatePath(`/admin/events/${eventId}`);
    return "Item opened for bidding.";
  });
}

export async function closeAuctionItemAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actorId = await requireAdminRole();
    const eventId = String(formData.get("eventId"));
    await closeAuctionItem(String(formData.get("itemId")), actorId);
    revalidatePath(`/admin/events/${eventId}`);
    return "Item closed.";
  });
}

export async function setCategoryCloseTimeAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    const actorId = await requireAdminRole();
    const eventId = String(formData.get("eventId"));
    const category = String(formData.get("category"));
    const closeAt = new Date(String(formData.get("closeAt")));
    const { count } = await setCategoryCloseTime(eventId, category, closeAt, actorId);
    revalidatePath(`/admin/events/${eventId}`);
    return `Set a close time for ${count} item${count === 1 ? "" : "s"} in "${category}".`;
  });
}

export async function retrySyncAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    await requireAdminRole();
    await syncTransactionToEtapestry(String(formData.get("transactionId")));
    revalidatePath("/admin/sync-log");
    return "Sync retried.";
  });
}

export async function createSolicitationAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    await requireAdminRole();
    const eventId = String(formData.get("eventId"));
    await createSolicitation({
      eventId,
      contactName: String(formData.get("contactName")),
      contactEmail: str(formData, "contactEmail") ?? "",
      contactPhone: str(formData, "contactPhone"),
      category: str(formData, "category"),
      notes: str(formData, "notes"),
      estimatedValueCents: cents(formData, "estimatedValueDollars"),
      status: (str(formData, "status") as SolicitationStatus) ?? "CONTACTED",
      assignedTo: str(formData, "assignedTo"),
    });
    revalidatePath(`/admin/events/${eventId}/solicitations`);
    return "Solicitation added.";
  });
}

export async function setSolicitationStatusAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    await requireAdminRole();
    const eventId = String(formData.get("eventId"));
    await setSolicitationStatus(
      String(formData.get("solicitationId")),
      formData.get("status") as Exclude<SolicitationStatus, "DONATED">,
    );
    revalidatePath(`/admin/events/${eventId}/solicitations`);
    return "Status updated.";
  });
}

export async function resetDemoDataAction(): Promise<ActionState> {
  return runAction(async () => {
    await requireAdminRole();
    // Server-side gate, not just a hidden button — DEMO_MODE off means this
    // destructive reset refuses to run even if someone calls the action
    // directly. See src/lib/demo/mode.ts.
    if (!isDemoModeEnabled()) {
      throw new Error("Demo reset is disabled — DEMO_MODE is not set.");
    }
    const { event } = await resetDemoData();
    revalidatePath("/admin");
    revalidatePath(`/admin/events/${event.id}`);
    revalidatePath("/admin/sync-log");
    return "Demo data reset.";
  });
}

export async function mergeConstituentsAction(_prev: ActionState, formData: FormData) {
  return runAction(async () => {
    await requireAdminRole();
    const orgId = String(formData.get("orgId"));
    const targetId = String(formData.get("targetId"));
    const sourceIds = formData
      .getAll("sourceId")
      .map(String)
      .filter((id) => id && id !== targetId);
    for (const sourceId of sourceIds) {
      await mergeConstituents(sourceId, targetId);
    }
    revalidatePath(`/admin/duplicates?orgId=${orgId}`);
    return `Merged ${sourceIds.length} record${sourceIds.length === 1 ? "" : "s"} — giving history now combines under the kept record.`;
  });
}

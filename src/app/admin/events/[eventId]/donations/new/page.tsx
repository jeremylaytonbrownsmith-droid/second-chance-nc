import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAuctionItemCategories, listAuctionItems } from "@/lib/admin/auction-items";
import { listSolicitationCategories } from "@/lib/admin/solicitations";
import { DonationIntakeForm } from "./DonationIntakeForm";

export default async function NewDonationPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    solicitationId?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    category?: string;
  }>;
}) {
  const { eventId } = await params;
  const prefill = await searchParams;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [itemCategories, solicitationCategories, existingItems] = await Promise.all([
    listAuctionItemCategories(eventId),
    listSolicitationCategories(eventId),
    listAuctionItems(eventId),
  ]);
  const categories = Array.from(new Set([...itemCategories, ...solicitationCategories])).sort();
  const nextItemNumber = `D${existingItems.length + 1}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Log a donation — {event.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Snap a photo, describe it, set a value and category — this creates the
          donor record, the item donor record (for the 8283 threshold), and the
          catalog item in one step. Fastest on a phone, works on any device.
        </p>
      </div>
      <DonationIntakeForm
        eventId={eventId}
        orgId={event.orgId}
        categories={categories}
        suggestedItemNumber={nextItemNumber}
        solicitationId={prefill.solicitationId}
        prefillContactName={prefill.contactName}
        prefillContactEmail={prefill.contactEmail}
        prefillContactPhone={prefill.contactPhone}
        prefillCategory={prefill.category}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckoutClient } from "./CheckoutClient";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const registrations = await prisma.registration.findMany({
    where: { eventId, voidedAt: null },
    include: { constituent: true },
    orderBy: { bidderNumber: "asc" },
  });

  return (
    <div className="space-y-4">
      {event.isDemo && (
        <div className="rounded bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
          DEMO MODE — payments are simulated, no real charge occurs
        </div>
      )}
      <h1 className="text-xl font-semibold">Checkout — {event.name}</h1>
      <CheckoutClient
        eventId={eventId}
        registrations={registrations.map((r) => ({
          id: r.id,
          bidderNumber: r.bidderNumber,
          name: r.constituent.isBusiness
            ? (r.constituent.orgName ?? "")
            : `${r.constituent.firstName ?? ""} ${r.constituent.lastName ?? ""}`.trim(),
        }))}
      />
    </div>
  );
}

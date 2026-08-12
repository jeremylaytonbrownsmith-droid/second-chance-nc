import Link from "next/link";
import { getOrCreateDemoEvent } from "@/lib/demo/seed";
import { prisma } from "@/lib/prisma";

export default async function BidderPickerPage() {
  const event = await getOrCreateDemoEvent();
  const registrations = await prisma.registration.findMany({
    where: { eventId: event.id, voidedAt: null },
    include: { constituent: true },
    orderBy: { bidderNumber: "asc" },
  });

  return (
    <div className="min-h-screen bg-brand-lavender-tint p-6">
      <div className="mx-auto max-w-md">
        <div className="mb-4 rounded bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
          DEMO MODE — no real bids, no real money
        </div>
        <h1 className="text-2xl font-semibold text-brand-purple-dark">
          {event.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pick a bidder to simulate their phone during the auction.
        </p>
        <div className="mt-6 space-y-3">
          {registrations.map((reg) => (
            <Link
              key={reg.id}
              href={`/bid/${reg.id}`}
              className="block rounded border border-brand-lavender bg-white p-4 shadow-sm hover:border-brand-purple"
            >
              <div className="font-semibold">
                Bidder #{reg.bidderNumber} —{" "}
                {reg.constituent.isBusiness
                  ? reg.constituent.orgName
                  : `${reg.constituent.firstName ?? ""} ${reg.constituent.lastName ?? ""}`.trim()}
              </div>
              <div className="text-xs text-neutral-500">
                {reg.status === "CHECKED_IN" ? "Checked in" : reg.status}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

import Image from "next/image";
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
    <div className="min-h-screen bg-gradient-to-b from-brand-lavender-tint to-white">
      <header className="border-b border-brand-lavender/40 bg-white/70 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Image
            src="/brand/second-chance-logo.png"
            alt="Second Chance Pet Adoptions"
            width={160}
            height={56}
            priority
            unoptimized
            className="h-8 w-auto"
          />
          <Link href="/live" className="text-xs font-medium text-brand-purple hover:underline">
            Just want to watch? See the live board →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5 rounded-lg bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
          DEMO MODE — no real bids, no real money
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-purple">Demo tool</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand-purple-dark">{event.name}</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Pick a bidder to simulate their phone during the auction.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {registrations.map((reg) => {
            const name = reg.constituent.isBusiness
              ? reg.constituent.orgName
              : `${reg.constituent.firstName ?? ""} ${reg.constituent.lastName ?? ""}`.trim();
            return (
              <Link
                key={reg.id}
                href={`/bid/${reg.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-brand-lavender/50 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-purple/60 hover:shadow-lg hover:shadow-brand-purple/10"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-lavender-tint to-brand-lavender/60 text-sm font-bold text-brand-purple-dark transition-colors group-hover:from-brand-purple group-hover:to-brand-purple-dark group-hover:text-white">
                  #{reg.bidderNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-neutral-900 group-hover:text-brand-purple-dark">
                    {name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {reg.status === "CHECKED_IN" ? "Checked in" : reg.status}
                  </div>
                </div>
              </Link>
            );
          })}
          {registrations.length === 0 && (
            <p className="text-sm text-neutral-500">No registrations yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

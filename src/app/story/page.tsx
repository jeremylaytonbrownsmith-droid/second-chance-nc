import { resetDemoData } from "@/lib/demo/seed";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { StoryPlayer } from "./StoryPlayer";

export const dynamic = "force-dynamic";

/**
 * Section 14's "scripted simulation" as a narrated, single-URL walkthrough
 * instead of a video — every scene drives the real backend (real bids,
 * real award, real checkout, real spreadsheet import), so what's on
 * screen is the actual running app, not a recording. Resets demo data on
 * every load so the run is deterministic regardless of prior sessions —
 * but only when DEMO_MODE is explicitly on. Without that gate, anyone
 * loading this URL in production (a stray link, a bot, a curious visitor)
 * would silently wipe and reseed whatever event sits under the demo
 * org/event row, including real catalog/registration data staff may be
 * mid-setup on before the gala. See src/lib/demo/mode.ts.
 */
export default async function StoryPage() {
  if (!isDemoModeEnabled()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gradient-to-b from-brand-lavender-tint to-white px-6 text-center">
        <h1 className="text-xl font-bold text-brand-purple-dark">Story mode is turned off</h1>
        <p className="max-w-sm text-sm text-neutral-500">
          This narrated walkthrough resets demo data on every visit, so it only runs when the
          server has <code className="rounded bg-neutral-100 px-1 py-0.5">DEMO_MODE=true</code> set.
        </p>
      </div>
    );
  }

  const { org, event, items, registrations } = await resetDemoData();

  return (
    <StoryPlayer
      eventId={event.id}
      eventName={event.name}
      orgId={org.id}
      lakeHouseItemId={items.lakeHouse.id}
      artPieceItemNumber={items.artPiece.itemNumber}
      bidders={[
        { registrationId: registrations.reg1.id, bidderNumber: 101 },
        { registrationId: registrations.reg2.id, bidderNumber: 102 },
        { registrationId: registrations.reg3.id, bidderNumber: 103 },
      ]}
    />
  );
}

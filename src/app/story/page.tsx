import { resetDemoData } from "@/lib/demo/seed";
import { StoryPlayer } from "./StoryPlayer";

export const dynamic = "force-dynamic";

/**
 * Section 14's "scripted simulation" as a narrated, single-URL walkthrough
 * instead of a video — every scene drives the real backend (real bids,
 * real award, real checkout, real spreadsheet import), so what's on
 * screen is the actual running app, not a recording. Resets demo data on
 * every load so the run is deterministic regardless of prior sessions.
 */
export default async function StoryPage() {
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

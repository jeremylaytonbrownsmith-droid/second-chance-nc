import { prisma } from "@/lib/prisma";
import { getSmsAdapter, isOutbidSmsEnabled } from "./index";

/**
 * Texts the bidder who just lost the lead on an item — best-effort,
 * fire-and-forget, same resilience contract as the eTapestry sync and
 * receipt email: a failure here is logged and never allowed to affect
 * the bid that already committed. Behind the ENABLE_OUTBID_SMS flag
 * (src/lib/sms/index.ts); a no-op when it's off, so this is safe to call
 * unconditionally from placeBid without an extra check at every call site.
 */
export async function notifyOutbid(
  itemId: string,
  outbidRegistrationId: string,
  newAmountCents: number,
): Promise<void> {
  if (!isOutbidSmsEnabled()) return;

  try {
    const [item, registration] = await Promise.all([
      prisma.auctionItem.findUnique({ where: { id: itemId }, select: { title: true, itemNumber: true } }),
      prisma.registration.findUnique({
        where: { id: outbidRegistrationId },
        select: { constituent: { select: { phone: true } } },
      }),
    ]);
    const phone = registration?.constituent.phone?.trim();
    if (!item || !phone) return;

    const body = `You've been outbid on ${item.itemNumber} - ${item.title}. New price: $${(newAmountCents / 100).toFixed(2)}.`;
    const result = await getSmsAdapter().sendSms({ to: phone, body });
    if (!result.ok) {
      console.error("notifyOutbid: provider rejected send for", outbidRegistrationId, result.error);
    }
  } catch (error) {
    console.error("notifyOutbid: failed for", outbidRegistrationId, error);
  }
}

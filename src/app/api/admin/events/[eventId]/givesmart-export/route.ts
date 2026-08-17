import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listAuctionItems } from "@/lib/admin/auction-items";
import { buildGiveSmartCsv, type GiveSmartExportRow } from "@/lib/givesmart/export";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const items = await listAuctionItems(eventId);

  const itemDonorIds = items.map((i) => i.itemDonorId).filter((id): id is string => Boolean(id));
  const itemDonors = itemDonorIds.length
    ? await prisma.itemDonor.findMany({
        where: { id: { in: itemDonorIds } },
        include: { constituent: true },
      })
    : [];
  const donorNameByItemDonorId = new Map(
    itemDonors.map((d) => [
      d.id,
      d.constituent.isBusiness
        ? (d.constituent.orgName ?? null)
        : [d.constituent.firstName, d.constituent.lastName].filter(Boolean).join(" ") || null,
    ]),
  );

  const rows: GiveSmartExportRow[] = items.map((item) => ({
    item,
    donorName: item.itemDonorId ? (donorNameByItemDonorId.get(item.itemDonorId) ?? null) : null,
  }));

  return new NextResponse(buildGiveSmartCsv(rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="givesmart-item-import.csv"',
    },
  });
}

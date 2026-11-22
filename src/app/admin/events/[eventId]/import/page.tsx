import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffRole } from "@/lib/admin/session";
import { AdminOnlyNotice } from "../../../AdminOnlyNotice";
import { ImportUploader } from "./ImportUploader";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if ((await getStaffRole()) !== "admin") return <AdminOnlyNotice />;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Import historical gift data — {event.name}</h1>
      <p className="text-sm text-neutral-500">
        Load a prior spreadsheet export to create the donor and gift records and
        compute correct tax statements from it.
      </p>
      <ImportUploader eventId={eventId} orgId={event.orgId} />
    </div>
  );
}

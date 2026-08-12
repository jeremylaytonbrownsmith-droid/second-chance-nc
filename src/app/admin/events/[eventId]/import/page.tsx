import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ImportUploader } from "./ImportUploader";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
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

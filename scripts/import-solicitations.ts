/**
 * CLI wrapper around src/lib/import/solicitation-spreadsheet.ts, for
 * loading a real outreach spreadsheet from the command line rather than
 * through the admin upload UI (/admin/events/[eventId]/solicitations).
 * Takes the source file as an argument rather than embedding any real
 * contact data in this script — the script is safe to commit, the
 * spreadsheet itself is not.
 *
 * Usage:
 *   npx tsx scripts/import-solicitations.ts <path-to-xlsx> <eventId> [sheetName]
 */
import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { importSolicitationRows, parseSolicitationWorkbook } from "../src/lib/import/solicitation-spreadsheet";

async function main() {
  const [, , filePath, eventId, sheetNameArg] = process.argv;
  if (!filePath || !eventId) {
    console.error(
      "Usage: npx tsx scripts/import-solicitations.ts <path-to-xlsx> <eventId> [sheetName]",
    );
    process.exit(1);
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    console.error(`No event found with id ${eventId}`);
    process.exit(1);
  }

  const buffer = await readFile(filePath);
  const { sheetName, rows, skippedBlank } = await parseSolicitationWorkbook(buffer, sheetNameArg);
  console.log(`Reading sheet "${sheetName}"`);
  console.log(`Parsed ${rows.length} contacts (${skippedBlank} blank rows skipped).`);

  const { created, updated } = await importSolicitationRows(eventId, rows);
  console.log(`Done. Created ${created}, updated ${updated}, under event ${eventId}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

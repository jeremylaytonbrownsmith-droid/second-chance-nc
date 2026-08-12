/**
 * Generic CSV serializer. CLAUDE.md hard rule 5: every table is exportable
 * to CSV from the admin UI — this is the one function every export route
 * should go through so escaping stays consistent.
 */

export interface CsvColumn<T> {
  header: string;
  /** Extract and stringify the cell value. Return "" for null/undefined. */
  value: (row: T) => string | number | boolean | Date | null | undefined;
}

function escapeCell(raw: string | number | boolean | Date | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  const str =
    raw instanceof Date
      ? raw.toISOString()
      : typeof raw === "string"
        ? raw
        : String(raw);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(","),
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}

import { describe, expect, it } from "vitest";
import { toCsv } from "./to-csv";

interface Row {
  name: string;
  amountCents: number;
  note: string | null;
}

describe("toCsv", () => {
  it("renders a header row and one row per record", () => {
    const rows: Row[] = [
      { name: "Jamie Rivera", amountCents: 15_000, note: null },
      { name: "Pat Nguyen", amountCents: 5_000, note: "cash" },
    ];
    const csv = toCsv(rows, [
      { header: "Name", value: (r) => r.name },
      { header: "Amount (cents)", value: (r) => r.amountCents },
      { header: "Note", value: (r) => r.note },
    ]);
    expect(csv).toBe(
      "Name,Amount (cents),Note\r\n" +
        "Jamie Rivera,15000,\r\n" +
        "Pat Nguyen,5000,cash\r\n",
    );
  });

  it("quotes and escapes cells containing commas, quotes, or newlines", () => {
    const rows = [{ name: 'Smith, "Bud" Jr.\nLine 2' }];
    const csv = toCsv(rows, [{ header: "Name", value: (r) => r.name }]);
    expect(csv).toBe('Name\r\n"Smith, ""Bud"" Jr.\nLine 2"\r\n');
  });

  it("renders an empty table as just the header row", () => {
    const csv = toCsv<Row>([], [{ header: "Name", value: (r) => r.name }]);
    expect(csv).toBe("Name\r\n");
  });

  it("formats Date values as ISO strings", () => {
    const rows = [{ when: new Date("2027-04-15T12:00:00.000Z") }];
    const csv = toCsv(rows, [{ header: "When", value: (r) => r.when }]);
    expect(csv).toBe("When\r\n2027-04-15T12:00:00.000Z\r\n");
  });
});

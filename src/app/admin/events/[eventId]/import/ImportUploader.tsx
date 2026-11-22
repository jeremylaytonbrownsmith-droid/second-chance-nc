"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { button, card, label as labelClass } from "../../../ui";

interface ImportRowOutcome {
  rowNumber: number;
  ok: boolean;
  error?: string;
  donorName?: string;
  amountCents?: number;
  deductibleCents?: number;
}

interface ImportSummary {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  donorsCreated: number;
  totalAmountCents: number;
  totalDeductibleCents: number;
  outcomes: ImportRowOutcome[];
}

export function ImportUploader({ eventId, orgId }: { eventId: string; orgId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const toast = useToast();

  async function handleSubmit() {
    setError("");
    setSummary(null);
    if (!file) {
      setError("Choose a .csv or .xlsx file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", eventId);
    formData.append("orgId", orgId);

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        const message = data.message ?? "Import failed";
        setError(message);
        toast.error(message);
        return;
      }
      setSummary(data);
      toast.success(`Imported ${data.importedRows} of ${data.totalRows} rows.`);
    } catch {
      const message = "Network error — try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className={card}>
        <p className="text-sm text-neutral-600">
          Expected columns (any reasonable header spelling works): <strong>Donor Name</strong>{" "}
          or <strong>Donor Email</strong>, <strong>Line Type</strong> (Auction Win, Raffle,
          Fund a Need, Cash Gift, Ticket, Sponsorship, Merch), <strong>Amount</strong>, and
          optionally <strong>FMV</strong> and <strong>Designation</strong>.
        </p>

        <label className={`mt-4 block ${labelClass}`}>File (.csv or .xlsx)</label>
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm"
        />

        <button onClick={handleSubmit} disabled={submitting} className={`mt-4 ${button.primary}`}>
          {submitting ? "Importing…" : "Import"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {summary && (
        <div className={card}>
          <h2 className="font-semibold">Results</h2>
          <ul className="mt-2 text-sm">
            <li>{summary.totalRows} rows found</li>
            <li className="text-green-700">{summary.importedRows} imported</li>
            <li className="text-red-600">{summary.skippedRows} skipped</li>
            <li>{summary.donorsCreated} new donors created</li>
            <li>
              Total paid: ${(summary.totalAmountCents / 100).toFixed(2)} — total
              deductible: ${(summary.totalDeductibleCents / 100).toFixed(2)}
            </li>
          </ul>

          {summary.skippedRows > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-red-600">Skipped rows</h3>
              <ul className="mt-1 space-y-1 text-xs text-neutral-600">
                {summary.outcomes
                  .filter((o) => !o.ok)
                  .map((o) => (
                    <li key={o.rowNumber}>
                      Row {o.rowNumber}: {o.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

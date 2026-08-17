"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { button, card, input, label as labelClass } from "../../../ui";

interface ImportSummary {
  sheetName: string;
  totalRows: number;
  skippedBlank: number;
  created: number;
  updated: number;
}

export function SolicitationImportUploader({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleSubmit() {
    setError("");
    setSummary(null);
    if (!file) {
      setError("Choose a .xlsx or .csv file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", eventId);
    if (sheetName.trim()) formData.append("sheetName", sheetName.trim());

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/solicitations/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Import failed");
        return;
      }
      setSummary(data);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={button.ghost}>
        Bulk import from spreadsheet
      </button>
    );
  }

  return (
    <div className={`${card} text-sm`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Bulk import from spreadsheet</h3>
        <button onClick={() => setOpen(false)} className={button.ghost}>
          Close
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Loads a real outreach spreadsheet — Company, Category, Status, Email, Phone, Solicitor,
        and similar columns, however they&rsquo;re labeled. Contacts already in this event are
        matched by name and updated rather than duplicated, so re-uploading an updated version
        of the same file is safe.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>File (.xlsx or .csv)</label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Sheet name (optional)</label>
          <input
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            placeholder="auto-detects an Outreach sheet"
            className={`w-56 ${input}`}
          />
        </div>
        <button onClick={handleSubmit} disabled={submitting} className={button.primary}>
          {submitting ? "Importing…" : "Import"}
        </button>
      </div>
      {error && <p className="mt-2 text-red-600">{error}</p>}
      {summary && (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-green-900">
          Sheet &ldquo;{summary.sheetName}&rdquo;: {summary.totalRows} contacts found
          {summary.skippedBlank > 0 && ` (${summary.skippedBlank} blank rows skipped)`} —{" "}
          <strong>{summary.created} added</strong>, <strong>{summary.updated} updated</strong>.
        </div>
      )}
    </div>
  );
}

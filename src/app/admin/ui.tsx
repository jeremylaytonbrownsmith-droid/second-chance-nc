/**
 * Shared button/table styling for the admin UI. Centralized so every
 * screen's actions and tables look like one system instead of each page
 * inventing its own underlined-text-link and bare-HTML-table treatment.
 * Plain className strings rather than components, since call sites mix
 * <button> (server-action forms) and <a> (plain links) under the same
 * visual treatment.
 */

export const button = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-purple px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple-dark disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-purple px-3 py-1.5 text-sm font-medium text-brand-purple transition-colors hover:bg-brand-lavender-tint disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50",
  // For rows that carry several actions at once (a status-change list, for
  // instance) — the padded pill treatment above reads fine at one-per-row
  // but wraps to one-per-line once three or four sit side by side. This
  // stays a plain, dense text action, the way GitHub/Linear-style admin
  // tables handle multi-action rows.
  tableAction:
    "whitespace-nowrap text-xs font-medium text-brand-purple transition-colors hover:text-brand-purple-dark hover:underline disabled:cursor-not-allowed disabled:opacity-50",
} as const;

export const card = "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5";

export const table = {
  wrapper: "overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm",
  table: "w-full border-collapse text-sm",
  headRow: "border-b border-neutral-200 bg-neutral-50 text-left",
  th: "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500",
  row: "border-b border-neutral-100 align-top transition-colors last:border-b-0 hover:bg-brand-lavender-tint/50",
  td: "px-4 py-2.5",
  empty: "px-4 py-6 text-center text-neutral-500",
} as const;

export const input =
  "rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple";

export const label = "text-xs font-medium text-neutral-500";

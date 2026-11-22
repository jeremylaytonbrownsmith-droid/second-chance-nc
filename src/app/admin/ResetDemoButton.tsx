"use client";

import { useTransition } from "react";
import { useToast } from "@/components/Toast";
import { resetDemoDataAction } from "./actions";

export function ResetDemoButton() {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleClick() {
    if (
      !window.confirm(
        "Reset all demo data? This wipes every demo bid, award, transaction, and gift and reseeds a fresh demo event.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await resetDemoDataAction();
      if (result.ok) {
        toast.success(result.message ?? "Demo data reset.");
      } else {
        toast.error(result.message ?? "Reset failed.");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded-lg border border-brand-purple px-3 py-1.5 text-xs font-medium text-brand-purple shadow-sm transition-colors hover:bg-brand-purple hover:text-white disabled:opacity-50"
    >
      {isPending ? "Resetting…" : "Reset demo data"}
    </button>
  );
}

"use client";

import { useTransition } from "react";
import { resetDemoDataAction } from "./actions";

export function ResetDemoButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        "Reset all demo data? This wipes every demo bid, award, transaction, and gift and reseeds a fresh demo event.",
      )
    ) {
      return;
    }
    startTransition(() => {
      resetDemoDataAction();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded border border-brand-purple px-3 py-1 text-xs font-medium text-brand-purple transition-colors hover:bg-brand-purple hover:text-white disabled:opacity-50"
    >
      {isPending ? "Resetting…" : "Reset demo data"}
    </button>
  );
}

"use client";

import { createContext, useContext, useId, type ReactNode } from "react";

const ModalCloseContext = createContext<(() => void) | null>(null);

/** Used by AdminForm to auto-close its enclosing modal on success, if
 * it's rendered inside one — see src/app/admin/AdminForm.tsx. */
export function useModalClose(): (() => void) | null {
  return useContext(ModalCloseContext);
}

/**
 * A plain <dialog>-backed modal — no new dependency, native focus-trap
 * and Escape-to-close behavior for free. Used to tuck rarely-used forms
 * (Add organization, Add event) behind a button instead of always
 * showing them inline on the dashboard.
 *
 * `children` is plain JSX, composed normally — including from a Server
 * Component parent — rather than a render-prop function, since a live
 * function reference can't cross the server/client boundary. The close
 * behavior reaches descendants (like AdminForm) through context instead,
 * which works fine once everything is mounted together in the browser.
 */
export function Modal({
  triggerLabel,
  triggerClassName,
  title,
  children,
}: {
  triggerLabel: string;
  triggerClassName: string;
  title: string;
  children: ReactNode;
}) {
  const dialogId = useId();
  const close = () => (document.getElementById(dialogId) as HTMLDialogElement | null)?.close();

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => (document.getElementById(dialogId) as HTMLDialogElement | null)?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog
        id={dialogId}
        className="w-full max-w-lg rounded-2xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onClose={(e) => (e.currentTarget as HTMLDialogElement).querySelector("form")?.reset()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded-md px-1.5 py-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              ✕
            </button>
          </div>
          <ModalCloseContext.Provider value={close}>
            <div className="mt-4">{children}</div>
          </ModalCloseContext.Provider>
        </div>
      </dialog>
    </>
  );
}

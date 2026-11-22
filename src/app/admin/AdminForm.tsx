"use client";

import { useActionState, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { useModalClose } from "./Modal";

/**
 * Wraps a server action bound to useActionState so every admin form gets
 * the same three things without repeating them: a toast on success or
 * failure, the form resetting itself after a real success, and an inline
 * error line as a fallback for anyone who dismissed the toast too fast.
 * Pair with <SubmitButton> inside for the loading state (via useFormStatus).
 */
export function AdminForm({
  action,
  successMessage,
  className,
  children,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  successMessage: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const handledRef = useRef(state);
  const modalClose = useModalClose();

  useEffect(() => {
    if (state === handledRef.current) return;
    handledRef.current = state;
    if (state.ok) {
      toast.success(state.message ?? successMessage);
      formRef.current?.reset();
      modalClose?.();
    } else {
      toast.error(state.message ?? "Something went wrong.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {!state.ok && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.message ?? "Something went wrong."}
        </p>
      )}
    </form>
  );
}

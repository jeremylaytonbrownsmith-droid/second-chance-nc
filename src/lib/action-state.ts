/** Shared return shape for every server action driven by useActionState,
 * so forms get a consistent way to show a toast + inline error instead of
 * an uncaught throw crashing into Next's default error overlay. */
export interface ActionState {
  ok: boolean;
  message?: string;
}

export const initialActionState: ActionState = { ok: true };

/** Wraps a server action body so any thrown error becomes a normal
 * { ok: false, message } result instead of an unhandled rejection. */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? undefined };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Gates the destructive demo tooling (the "Reset demo data" button, and
 * /story's auto-reset-on-every-load) so it only runs where someone
 * explicitly opted in. Without this, loading /story in production would
 * silently wipe and reseed whatever event is sitting under the demo
 * org/event row — including real catalog/registration data staff may be
 * configuring through /admin before sign-off to flip to a real event.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE === "true";
}

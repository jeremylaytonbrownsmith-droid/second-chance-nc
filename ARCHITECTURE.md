# Architecture & runbook

This is the "how it actually works and why" doc — CLAUDE.md stays focused
on the hard, non-negotiable rules (money, tax, deletes); this is for
everything else: the shape of the codebase, the data model, how it
deploys, and the gotchas that cost real time to work out. **Keep this
updated in the same change whenever something it describes changes** —
a new adapter, a new model, a new gotcha worth not re-discovering.

## What this is

A gala auction and giving system for Second Chance Pet Adoptions,
replacing a spreadsheet-and-hand-keying workflow with one record of
truth per donor per event, syncing clean gift records into eTapestry.
Three audiences, three surfaces:

- **Admin** (`/admin/*`) — staff running the event: catalog, check-in,
  checkout, donor records, statements, sync log.
- **Bidder** (`/bid/*`) — a guest's own phone: browse items, bid, buy it
  now, donate.
- **Public/live** (`/live`, `/live/projector`, `/story`) — screens for
  the room, no login: a live board, a kiosk-style projector mode, and a
  scripted walkthrough of the whole system for demos.

## Stack

Next.js (App Router) + TypeScript, PostgreSQL via Prisma, Tailwind v4,
Vitest for unit tests, Playwright for end-to-end tests. No separate
backend — everything is Server Components, Server Actions, and Route
Handlers in this one app.

## Directory map

```
src/
  app/
    admin/            Staff-facing pages. ui.tsx/badges.tsx/icons.tsx are
                       shared presentational building blocks; AdminChrome
                       is the layout (nav, role badge, toast provider);
                       AdminForm+SubmitButton+Modal are the shared form
                       plumbing (useActionState wrapper, loading state,
                       native <dialog>-based modals).
    admin/events/[eventId]/
                       Everything scoped to one event: catalog (page.tsx),
                       check-in, live board, clerk, checkout, fund-a-need,
                       pickup, solicitations, donations/new, import.
                       layout.tsx adds the shared tab nav (EventSubNav) to
                       all of them.
    bid/               Guest bidder view. BidBoard.tsx is the main client
                       component (bidding, buy-it-now, the offline queue).
    live/, live/projector/, story/
                       Public, no-login surfaces.
    api/               Route Handlers. /api/admin/* mirrors the Server
                       Actions for callers that need a JSON API (CSV
                       exports, PDFs); /api/bid, /api/donate, /api/realtime
                       are guest-facing and intentionally ungated.
  lib/
    admin/             CRUD + business logic for each entity (events,
                       organizations, constituents, auction-items,
                       item-donors, solicitations, duplicate-detection,
                       audit-log, session — role resolution).
    auction/           Bidding engine (bidding.ts — placeBid, buy-it-now,
                       proxy/max-bid resolution, staggered close, award
                       resolution), checkin.ts, clerk.ts (hammer price),
                       pickup.ts, fund-a-need.ts.
    checkout/          runCheckout — the one place every payment flows
                       through, regardless of entry point (staff checkout,
                       guest self-serve donate, fund-a-need batch).
    money/             deductible.ts (the pure function everything money
                       runs through) and substantiation.ts (quid pro quo /
                       8283 threshold rules). Tax caveat lives in
                       CLAUDE.md — read that before touching either file.
    statements/        Year-end donor statements (PDF + CSV).
    receipts/          Per-transaction acknowledgment PDF.
    realtime/          Postgres LISTEN/NOTIFY wrapper, fanned out over SSE.
    offline/           Browser-side bid queue (localStorage-backed retry).
    etapestry/, email/, sms/, payments/
                       Adapter-pattern integrations — see below.
    demo/              Demo-mode seed data and the "Reset demo data" flow.
prisma/schema.prisma   The data model (see below).
e2e/                   Playwright specs — full-event-flow.spec.ts (check
                       in → bid → outbid → close → checkout → receipt →
                       sync) and admin-route-auth.spec.ts (role-gating
                       regression tests). Run with `npm run test:e2e`.
```

## Data model (prisma/schema.prisma)

Grouped by what they're for, not alphabetically:

- **Org structure**: `Organization` → `Event` (one gala). `Event.isDemo`
  marks the one event the demo-reset flow owns — never a real one.
- **People**: `Constituent` (a donor/bidder/org, org-scoped) →
  `Registration` (one constituent's presence at one event — bidder
  number, check-in status, the processor tokens for their card —
  never a raw card number, see CLAUDE.md hard rule 1). A `Constituent`
  can be merged into another (`mergedIntoId` — see duplicate-detection.ts)
  without losing its giving history; statements resolve through the
  merge chain.
- **The catalog**: `AuctionItem` (status: DRAFT → OPEN → AWARDED/UNSOLD;
  `closeAt` drives staggered close), `Bid` (one row per bid, proxy bids
  included — `isMaxBid`, `clientRequestId` for offline-queue
  idempotency), `Award` (who won what, for how much, `pickedUpAt`),
  `ItemDonor` (who donated the item — 8283 thresholds), `Solicitation`
  (an ask that hasn't converted to a donated item yet).
- **Money**: `Transaction` (one checkout, one payment) → `TransactionLine`
  (one per thing paid for — AUCTION_WIN/RAFFLE/FUND_A_NEED/CASH_GIFT/etc,
  each with its own computed `deductibleCents`), `Receipt` (the
  acknowledgment sent for one transaction — receipts are immutable, a
  correction voids and reissues, never edits in place).
- **Operational**: `SyncLog` (eTapestry push queue — idempotent via a
  payload hash, retryable), `AuditLog` (every money-touching mutation —
  who, what, before/after, via `auditedMutation` in `src/lib/audit.ts`).

Nothing is ever hard-deleted — `voidedAt`/`voidReason` on every table
that needs it (CLAUDE.md hard rule 4).

## The adapter pattern

Four integrations follow the exact same shape: an interface
(`adapter.ts`), a `Fake*` implementation (default everywhere — tests,
local dev, demo mode), and a real implementation picked up automatically
when its env var is set (`src/lib/*/index.ts`'s `get*()` function,
cached, with a `set*ForTesting()` escape hatch). Nothing outside the
adapter's own folder should know which real provider is behind it.

| Integration | Real adapter | Env var | Notes |
|---|---|---|---|
| eTapestry | `demo-sync.ts` | — | **Still fake.** The real SOAP integration has never been attempted against a live eTapestry account — this is the biggest remaining gap in "real" sync, separate from the payment gap below. |
| Email | `resend-adapter.ts` | `RESEND_API_KEY` + `EMAIL_FROM_ADDRESS` | Plain `fetch()`, not the Resend SDK. |
| SMS | `twilio-adapter.ts` | `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` + `ENABLE_OUTBID_SMS=true` | Off by default even with credentials present. |
| Payments | `stripe-adapter.ts` | `STRIPE_SECRET_KEY` | Plain `fetch()` against Stripe's REST API. **Charges an existing customer + payment method only** — nothing in this repo yet collects a card and populates `Registration.paymentCustomerRef`/`paymentMethodRef` in the first place. Setting the key alone makes every card checkout cleanly decline ("no card on file") rather than silently doing nothing — that's intentional, not a bug, but it means this integration isn't actually usable end-to-end yet. |

## Auth

No real per-person accounts — two shared passwords (admin, volunteer),
gated by `src/proxy.ts` on `/admin/*` and `/api/admin/*` only (guest
routes are never gated). The proxy resolves which credential pair a
session cookie matches and writes the verified role to an `x-staff-role`
request header — **always trust that header, never anything
client-supplied** — downstream code reads it via `getStaffRole()` /
`requireAdminRole()` / `requireStaffRole()` in `src/lib/admin/session.ts`.
`requireAdminRole()` vs `requireStaffRole()` is the admin/volunteer split
(FMV, payments, donors, event settings vs check-in, bids, pickup) —
**every** `/api/admin/*` route needs its own explicit call to one of
these; the proxy only confirms *some* staff role exists, not which one
(see the "Security" section below for what happens when a route skips
this).

## Real-time bidding

Postgres `LISTEN`/`NOTIFY` (`src/lib/realtime/notify.ts`), fanned out
over Server-Sent Events (`/api/realtime/items/[itemId]`). `LISTEN` needs
a direct, session-scoped connection — **not** the pooled `DATABASE_URL`
Prisma uses everywhere else, which can hand the underlying connection to
a different client mid-session under transaction-mode pooling (PgBouncer,
Neon's pooler). Use `DATABASE_URL_UNPOOLED` if the host provides one;
falls back to `DATABASE_URL` otherwise (fine without a pooler).

## No background job scheduler

Time-based state transitions (an item's `closeAt` passing) aren't driven
by a worker — there isn't one. `closeExpiredItemsForEvent` runs as a
lazy sweep at the top of every page that lists items, plus a
defense-in-depth re-check inside `placeBid` itself for the gap between
sweeps. If this app ever needs real scheduled work (e.g. a reminder
email N days before an event), that's a real gap to close, not
something to extend this pattern to cover.

## Testing

- **Unit/integration** (Vitest, `npm test`): library-level, one test file
  per `lib/` module that has real logic. Tests that touch Postgres use
  `describe.skipIf(!dbAvailable)` (checked via a `SELECT 1` at module
  load) and clean up their own created rows in `afterAll`.
- **End-to-end** (Playwright, `npm run test:e2e`): `e2e/full-event-flow.spec.ts`
  drives the entire event through the real UI against a real database —
  this is the test that would catch a regression nothing else would.
  `e2e/admin-route-auth.spec.ts` is a security regression suite (role
  gating on sensitive routes). Both specs share one demo event/org
  rather than isolated fixtures, so `playwright.config.ts` pins
  `workers: 1` — running spec files in parallel causes them to collide
  resetting the same demo data (this actually happened once; see its
  git history for the exact symptom).
- **CI** (`.github/workflows/ci.yml`): typecheck + lint + unit tests +
  build in one job, the Playwright suite in another, both against a real
  Postgres service container, both required. Added late relative to the
  rest of this project — verified locally against a from-scratch database
  before being trusted, but not yet proven on an actual GitHub Actions
  run as of the commit that added it; check its Actions tab if in doubt.

## Deploying

`npm run build` runs `prisma migrate deploy` (applies any pending
migration, never generates one) then `next build`. Required env vars are
documented in `.env.example` — copy it to `.env` and fill in what you
need; nothing in this app will start without `DATABASE_URL` at minimum,
and the fake adapters mean it runs completely demo-functional with
nothing else set.

## Known gaps (not bugs, just not done)

- **No real card collection.** See the payments row above.
- **eTapestry is still fake end to end.**
- **No real per-person staff auth**, just two shared passwords.
- **Tax/receipting logic has an explicit, unresolved sign-off gate** —
  see CLAUDE.md. Built and tested against the general federal rules;
  not yet confirmed against this org's actual receipting practice.
- **Never run under real concurrent load** (a room full of phones bidding
  at once) — concurrency *correctness* is tested (two bids on the same
  item at the same instant, offline queue replay), but not at that scale.

## Gotchas worth not re-discovering

A handful of things that cost real debugging time this project, in case
they bite again:

- **Throwing inside `prisma.$transaction` rolls back everything written
  through that transaction's `tx` client** — including a write you
  intended as "this happens regardless of the throw." If you need a
  write to survive a deliberate throw (e.g. "close this item out, then
  report that a bid attempt lost the race"), make that write through the
  top-level `prisma` client, in a separate transaction, after the
  original one has unwound — not through `tx`. Hit this twice: once
  where the fix was straightforward, once where the "obvious" fix
  deadlocked (see next point).
- **...and doing that write through the top-level client while the
  original transaction still holds a row lock on the same row will
  deadlock**, not just fail — the second write blocks forever waiting
  for a lock the first transaction can't release because it's still
  waiting on that same write. The fix is to let the original transaction
  actually finish (commit or roll back) before attempting the follow-up
  write, which usually means restructuring to throw a typed error
  carrying what the follow-up needs, caught in a `.catch()`/`try` *after*
  the `$transaction(...)` call returns.
- **Postgres's `ORDER BY` defaults to `NULLS LAST` for `ASC`**, not
  `NULLS FIRST` — easy to assume the opposite. Matters anywhere you want
  "unset" to sort first (e.g. unclaimed pickups before claimed ones);
  use Prisma's `{ field: { sort: "asc", nulls: "first" } }`.
  explicitly.
- **A live function/closure can't be passed as a prop from a Server
  Component to a Client Component** — only plain serializable data or a
  `"use server"` Server Action can cross that boundary. A modal
  component that wants to let its (server-composed) children close it on
  success can't take a `close` callback as a render-prop argument from a
  Server Component parent; use React Context from the Client Component
  side instead (see `src/app/admin/Modal.tsx`'s `useModalClose`).
- **Modern Chromium's canvas `fillStyle` getter no longer normalizes
  `lab()`/`oklch()` colors to `rgb()`** — it echoes the input back
  verbatim. Tailwind v4 can emit those color functions from
  `getComputedStyle().color`. If you ever write a script that reads
  computed colors (a contrast checker, a screenshot diff tool), don't
  trust `ctx.fillStyle` as a normalizer — actually draw a pixel and read
  the backing store (`getImageData`), which is sRGB regardless of the
  input color space.
- **A plain `PrismaClient` structurally satisfies the
  `Prisma.TransactionClient` type** for simple calls (same method
  shapes), which is useful: a helper function typed to take a
  transaction client can be called with the top-level `prisma` client
  too, for the "do this outside any transaction" case, without a second
  overload.

## Security

Before this app runs a live event with real money, read CLAUDE.md's hard
rules and the credential/decision list that's been reported back over
the course of this project (Resend/Twilio/Stripe keys, accountant
sign-off, a real-auth decision). A couple of findings worth recording
here since they're the kind of thing worth checking for again later:

- Every `/api/admin/*` route needs its **own** explicit
  `requireAdminRole()`/`requireStaffRole()` call — the shared proxy gate
  only confirms *some* staff role exists, not which one. Two routes
  (`givesmart-export`, the admin receipts PDF lookup) shipped without
  one and relied on the proxy alone; found in a routine pass, fixed,
  and now covered by `e2e/admin-route-auth.spec.ts` so it can't come
  back unnoticed.
- `npm audit` found several known advisories in transitive dependencies
  (sharp, source-map-js, a `uuid` version `exceljs` depends on) that
  only resolve via a Next.js major-ish bump or an `exceljs` major bump —
  both deliberately left alone pending a decision, rather than forced
  silently, since both are the kind of dependency change that can carry
  real behavioral risk. Worth a `npm audit` pass again periodically, and
  worth deciding on those two bumps deliberately rather than by default.

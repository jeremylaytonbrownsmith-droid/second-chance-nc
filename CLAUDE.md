@AGENTS.md

# Second Chance Pet Adoptions: Auction and Giving System

This repo replaces the spreadsheet-and-hand-keying chain that Second Chance
uses today for gala auction and giving records, with one record of truth per
donor per event that syncs clean gift records into eTapestry.

Full spec lives in the original build brief provided by the client/PM. The
rules below are the non-negotiable constraints extracted from it. If any
future instruction conflicts with these, stop and ask before proceeding.

## No tax logic ships without accountant sign-off

**Do not implement or change the tax and receipting logic below until the
organization's accountant has signed off on it in writing.** The deductible
table, quid pro quo thresholds, and substantiation rules in this file are the
general federal rules as commonly applied — a nonprofit's receipting practice
is theirs to set, not ours. Treat every number in this section as
`[UNVERIFIED]` until sign-off exists, and say so if asked to build on top of
it before that happens.

## Hard rules (Section 3)

1. **Never store card numbers.** Payment credentials live with the payment
   processor. The database stores a customer reference and a payment method
   reference, nothing else.
2. **All money is integer cents.** No floats, anywhere, ever. Amounts are
   `Int` in Prisma and named with a `_cents` suffix.
3. **Every mutation that touches money writes an audit row.** Who, what,
   when, before value, after value. Non-negotiable — this is a nonprofit
   handling other people's donations.
4. **Nothing is hard deleted.** Soft delete with `voided_at` and a reason.
5. **Every table is exportable to CSV from the admin UI.** The client must
   never feel trapped in this system.
6. **eTapestry is a sync target, not the schema.** Our data model stands on
   its own. If they change CRMs in three years, we swap an adapter, not the
   application.

## The deductible calculation (Section 5) — pure function, tested first

`deductibleCents` is computed per `TransactionLine`. This table is the heart
of the system; everything else is scaffolding around it. Build it as a pure
function with exhaustive unit tests before writing any CRUD around it.

| Line type      | Deductible amount                                                              |
|----------------|----------------------------------------------------------------------------------|
| `AUCTION_WIN`  | `max(0, amount_cents - fmv_cents)`                                              |
| `RAFFLE`       | Zero. Raffle ticket purchases are not charitable contributions.                 |
| `FUND_A_NEED`  | Full amount. Nothing is received in return.                                    |
| `CASH_GIFT`    | Full amount.                                                                    |
| `TICKET`       | `max(0, amount_cents - fmv_cents)` where FMV is the meal and entertainment value |
| `SPONSORSHIP`  | `max(0, amount_cents - fmv_cents)` where FMV is the value of benefits received  |
| `MERCH`        | Zero, unless priced above FMV, then the excess                                 |

Rules the engine enforces:

1. FMV is required on every `AuctionItem` before it can open for bidding.
   Block it in validation.
2. Quid pro quo disclosure triggers when a transaction total exceeds $75 and
   the donor received goods or services in return. Trigger per transaction,
   not per line.
3. Contributions of $250 or more require a contemporaneous written
   acknowledgment stating whether goods or services were provided.
4. Item donors claiming a value over $500 need Form 8283. Over $5,000, the
   organization signs Part IV.
5. When an item that came in on an 8283 over $5,000 sells, create an 8282
   filing task due 125 days from the sale and surface it on the admin
   dashboard.
6. Deductible amounts are never negative. Floor at zero.
7. Receipts are immutable. Corrections issue a new receipt that voids the
   prior one by reference — never edit a sent receipt in place.

## Working conventions

- Stack: Next.js (App Router) + TypeScript, PostgreSQL via Prisma, Vitest
  for unit tests.
- Build order for Phase 1: schema → deductible calculation as a pure
  function with exhaustive tests → admin CRUD around it → eTapestry adapter
  behind an interface with a fake implementation for tests.
- The eTapestry integration is SOAP-based. Wrap it in a thin adapter module
  (`src/lib/etapestry/adapter.ts`) with a clean TypeScript interface.
  Everything else in the app talks to the adapter, never to SOAP directly.
  Tests run against a fake implementation of that interface.
- Sections marked `[UNVERIFIED]` in the original spec are assumptions, not
  requirements — confirm with the client before code that depends on them
  ships.

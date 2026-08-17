import type { ReactNode } from "react";
import Link from "next/link";

const SECTIONS = [
  { id: "overview", label: "What this system is" },
  { id: "how-it-fits", label: "How the pieces fit together" },
  { id: "setup", label: "Setting up an event" },
  { id: "soliciting", label: "Soliciting and logging donations" },
  { id: "auction-night", label: "Running the event" },
  { id: "tax-math", label: "How the tax math works" },
  { id: "etapestry", label: "Donor CRM (eTapestry) sync" },
  { id: "givesmart", label: "GiveSmart export" },
  { id: "import", label: "Importing a spreadsheet" },
  { id: "demo-mode", label: "Demo mode" },
  { id: "faq", label: "Common questions" },
];

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-xl font-semibold text-brand-purple-dark">
      {children}
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-neutral-700">{children}</p>;
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">How this system works</h1>
      <p className="mt-2 text-sm text-neutral-500">
        A plain-language guide to every screen — written for the people who’ll actually
        run a gala with this, not for developers.
      </p>

      <nav className="mt-6 rounded border border-brand-lavender bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          On this page
        </p>
        <ul className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-brand-purple hover:underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-12 pb-16">
        <section>
          <H2 id="overview">What this system is</H2>
          <P>
            This replaces the spreadsheet-and-hand-keying chain most galas run on today.
            One place holds the auction catalog, who bid what, who owes what, and what
            portion of each gift is tax-deductible — instead of an auction tool, a
            separate payment log, and someone reconciling both by hand afterward.
          </P>
          <P>
            Everything you’re looking at right now is a working demo, seeded with fake
            data, so you (and anyone you show it to) can click through the real thing
            without touching an actual donor’s information.
          </P>
        </section>

        <section>
          <H2 id="how-it-fits">How the pieces fit together</H2>
          <P>The system is organized in layers, each one built on the one before it:</P>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
            <li>
              <strong>Organization</strong> — the nonprofit itself (name, EIN, fiscal year).
            </li>
            <li>
              <strong>Event</strong> — one gala. Everything else below belongs to one event.
            </li>
            <li>
              <strong>Constituents</strong> — the people involved: bidders, donors, item
              donors. One person record, reused everywhere they show up.
            </li>
            <li>
              <strong>Auction items</strong> — the catalog, each with a required fair
              market value (FMV) before it’s allowed to open for bidding.
            </li>
            <li>
              <strong>Bids and awards</strong> — what happened during the auction: who bid
              what, and who ultimately won each item.
            </li>
            <li>
              <strong>Transactions</strong> — one consolidated checkout per bidder,
              covering everything they owe (auction wins, raffle tickets, a cash gift,
              whatever they added).
            </li>
            <li>
              <strong>Receipts</strong> — generated from a transaction, showing exactly how
              much of what they paid is tax-deductible and why.
            </li>
          </ol>
        </section>

        <section>
          <H2 id="setup">Setting up an event</H2>
          <P>Before the gala, from the Dashboard’s Organizations and Events tables:</P>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
            <li>Add the organization once (name, EIN, fiscal year start).</li>
            <li>Add an event under that organization (name, date, tax year).</li>
            <li>
              Open the event and add constituents — the people who’ll be bidders, gift
              donors, or item donors.
            </li>
            <li>
              Add auction items and set a fair market value on each one. An item{" "}
              <strong>cannot open for bidding without an FMV</strong> — that’s enforced by
              the system, not just a suggestion, because the FMV is what makes the tax
              math correct later.
            </li>
            <li>
              If someone donated an item rather than bought a ticket, record them as an
              item donor with the value they’re claiming. Claims over $500 automatically
              get flagged as needing IRS Form 8283.
            </li>
          </ol>
        </section>

        <section>
          <H2 id="soliciting">Soliciting and logging donations</H2>
          <P>
            Before there&rsquo;s a catalog, there&rsquo;s an ask list — the businesses and
            individuals staff have reached out to, weeks or months before the event. The{" "}
            <strong>Solicitations</strong> screen tracks that: a contact, one or more
            category tags, who on the team is working it, and a status — Prospect,
            Contacted, Committed, Donated, Declined, or Do Not Contact (a permanent
            suppression flag, separate from a plain decline, for a closed business or a
            relationship the org doesn&rsquo;t want re-approached) — all searchable and
            filterable. Nothing here is a real donor record yet — it&rsquo;s deliberately
            lightweight, since most asks don&rsquo;t convert. This status vocabulary was
            built directly from the organization&rsquo;s own multi-year outreach
            spreadsheet, not guessed at.
          </P>
          <P>
            When something actually comes in, use <strong>Log a Donation</strong> — built
            like an expense-report app: take a photo (or a few), write a short description,
            set a category and an estimated value, and save. That one step creates the
            donor record, the item donor record (which drives the Form 8283 threshold), and
            the catalog item itself — no separate re-entry. If you got there from a
            solicitation, that ask is automatically marked Donated and linked to the new
            item. The estimated value fills in the item&rsquo;s fair market value as a
            starting point; confirm or adjust it from the Item Catalog before the item opens
            for bidding.
          </P>
        </section>

        <section>
          <H2 id="auction-night">Running the event</H2>
          <P>
            <strong>Bidder View</strong> — the mobile page bidders use on their own phones
            to browse open items and place bids. The current price updates on everyone’s
            screen the instant someone bids — no refreshing.
          </P>
          <P>
            <strong>Live Auction Clerk</strong> — for the live-auction portion where an
            auctioneer calls out winners by paddle number. One screen: item number, paddle
            number, hammer price, next. Built to be usable by a volunteer with ten minutes
            of training.
          </P>
          <P>
            <strong>Checkout</strong> — at the end of the night (or any time), pull up a
            bidder, see everything they owe across auction wins and any gifts, add a
            fund-a-need donation or a cash gift on the spot, and complete one payment that
            covers all of it.
          </P>
          <P>
            <strong>Receipt</strong> — generated automatically after checkout. Shows the
            paid amount, the fair market value, and the deductible amount for every single
            line — plus the required disclosure language when it applies.
          </P>
        </section>

        <section>
          <H2 id="tax-math">How the tax math works</H2>
          <P>
            This is the part that actually matters, so here it is in plain language. When
            someone pays for something and gets something back in return — like winning an
            auction item — only the amount above what that item is really worth counts as
            a charitable gift. Someone who pays $300 for a fair-market-value $150 gift
            basket only gets a $150 deduction, not $300.
          </P>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>Auction wins, event tickets, sponsorships, and marked-up merchandise all follow that same “amount minus value received” rule.</li>
            <li>Raffle tickets are never deductible at all, by law — that’s just a rule, not a calculation.</li>
            <li>Cash gifts and fund-a-need donations are fully deductible, since nothing is given in return.</li>
            <li>A gift is never shown as a negative deductible amount — it floors at zero.</li>
          </ul>
          <P>
            The system also automatically flags two disclosure requirements: when a
            payment exceeds $75 and includes something in return, and when a gift totals
            $250 or more requiring a written acknowledgment. You don’t have to remember
            these thresholds — the receipt does it for you.
          </P>
          <div className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            <strong>Important:</strong> these are the general federal rules as commonly
            applied. Before this runs on real donor data, the organization’s accountant
            needs to review and sign off on this logic in writing — a nonprofit’s
            receipting practice is theirs to set.
          </div>
        </section>

        <section>
          <H2 id="etapestry">Donor CRM (eTapestry) sync</H2>
          <P>
            The plan is for every completed gift to automatically sync to the
            organization’s eTapestry account, so donor records and gift history stay in
            one place instead of two. That connection isn’t live yet — eTapestry’s own API
            access has to be turned on by someone with admin rights on their account, which
            is outside of what this software can do on its own.
          </P>
          <P>
            Until that access exists, the Sync Log page shows exactly what will happen
            once it’s connected — the same retry/idempotency logic, just talking to a
            simulated version of eTapestry instead of the real one. Nothing here needs to
            be rebuilt when the real connection goes live, only the one piece that
            actually talks to eTapestry gets swapped in.
          </P>
        </section>

        <section>
          <H2 id="givesmart">GiveSmart export</H2>
          <P>
            Some organizations run live bidding, registration, and ticketing through
            GiveSmart rather than the Bidder View built into this system — and today, that
            means re-typing every catalog item into GiveSmart by hand, matching item
            numbers so a winning bid ties back to the right physical item. The{" "}
            <strong>Export for GiveSmart</strong> link on the Item Catalog page generates a
            CSV of the whole catalog — item number, name, description, category, fair
            market value, donor — ready to upload through GiveSmart&rsquo;s own item-import
            tool instead of retyping it.
          </P>
          <div className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            <strong>Important:</strong> this is a file you upload, not a live connection —
            no public GiveSmart API for pushing items in was available while building this.
            Check the column headers below against Manage → Items → Import in the real
            GiveSmart account before relying on it; the exact template can vary by account.
          </div>
        </section>

        <section>
          <H2 id="import">Importing a spreadsheet</H2>
          <P>
            If the organization has gift records in a spreadsheet today — from eTapestry,
            their old auction tool, or anywhere else — the Import Spreadsheet screen loads
            a .csv or .xlsx file, matches up donors, and runs every row through the exact
            same tax-math engine described above. It’s a good way to prove the numbers
            hold up: import last year’s real spreadsheet and check the totals against what
            they already know is correct.
          </P>
          <P>
            Expected columns are flexible — Donor Name or Email, a gift type (Auction Win,
            Raffle, Fund a Need, Cash Gift, Ticket, Sponsorship, Merch), an Amount, and
            optionally an FMV and a designation/fund.
          </P>
        </section>

        <section>
          <H2 id="demo-mode">Demo mode</H2>
          <P>
            Every screen you can reach from this dashboard is working against a demo
            event — clearly marked with a yellow banner — seeded with fake bidders and
            items. Nothing here touches real donor data. The “Reset demo data” button in
            the header wipes it back to a clean starting point at any time, so you can run
            through the same demo twice in front of different people without cleanup in
            between.
          </P>
        </section>

        <section>
          <H2 id="faq">Common questions</H2>
          <P>
            <strong>The “Bid” button won’t let a bidder bid, or an item won’t open.</strong>{" "}
            Check the Item Catalog — the item needs a fair market value set and its status
            needs to be OPEN before bidding works.
          </P>
          <P>
            <strong>The other bidder’s screen isn’t updating live.</strong> That relies on
            an active connection; a spotty venue wifi network is exactly the situation the
            system is designed to be honest about rather than fail silently on. Refreshing
            the page always pulls the current correct state.
          </P>
          <P>
            <strong>I can’t get past the login prompt.</strong> That’s a temporary password
            gate standing in for real staff accounts, which come later. If credentials
            stop working, they need to be reset from the hosting dashboard’s environment
            variables.
          </P>
          <P>
            <strong>Where do real payments happen?</strong> They don’t yet — checkout in
            this build simulates a charge so the math and the receipt can be demonstrated
            without a live payment processor connected.
          </P>
        </section>
      </div>

      <Link href="/admin" className="text-sm text-brand-purple hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  );
}

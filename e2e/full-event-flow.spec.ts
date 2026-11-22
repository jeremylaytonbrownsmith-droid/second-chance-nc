import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Event night item 17: the full event flow, end to end, driven through
 * the real UI exactly the way the people at a gala would use it — not a
 * shortcut through library functions. Each step's success is a
 * precondition for the next, so this runs as one serial test rather than
 * independent cases: a "receipt" test with no checkout before it would
 * just be asserting against fabricated data.
 *
 * check in -> bid -> outbid -> close -> checkout -> receipt -> eTapestry sync
 *
 * Requires a running dev server (see playwright.config.ts's webServer)
 * and a reachable Postgres database — this talks to both the app over
 * HTTP and the database directly, the same way this session's ad hoc
 * verification scripts did throughout Event Night development, except
 * committed and repeatable instead of thrown away after one run.
 */

const prisma = new PrismaClient();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "secondchance";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "localdevpassword";

async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.fill('input[name="username"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin");
}

async function checkInWalkIn(page: Page, eventId: string, firstName: string, lastName: string) {
  await page.goto(`/admin/events/${eventId}/checkin`);
  const addWalkInButton = page.locator('button:has-text("Add as a walk-in")');
  if ((await addWalkInButton.count()) > 0) {
    await addWalkInButton.click();
  }
  await page.locator('input[name="firstName"]').fill(firstName);
  await page.locator('input[name="lastName"]').fill(lastName);
  await page.click('button[type="submit"]:has-text("Check in")');
  await expect(page.locator("text=/Checked in/i").first()).toBeVisible({ timeout: 10_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("full event flow", () => {
  let eventId: string;
  let itemId: string;
  let bidder1RegistrationId: string;
  let bidder2RegistrationId: string;
  let transactionId: string;

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("admin resets demo data for a clean, known starting state", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await loginAsAdmin(page);
    await page.click('button:has-text("Reset demo data")');
    await page.waitForTimeout(1500);

    const eventHref = await page.locator('a[href^="/admin/events/"]').first().getAttribute("href");
    eventId = eventHref!.split("/admin/events/")[1].split("/")[0];
    expect(eventId).toBeTruthy();

    const item = await prisma.auctionItem.findFirstOrThrow({
      where: { eventId, itemNumber: "S1", itemType: "SILENT" },
    });
    itemId = item.id;
    expect(item.status).toBe("OPEN");
  });

  test("check in two bidders", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    await loginAsAdmin(page);

    await checkInWalkIn(page, eventId, "Flow", "BidderOne");
    await checkInWalkIn(page, eventId, "Flow", "BidderTwo");

    const regs = await prisma.registration.findMany({
      where: { eventId, status: "CHECKED_IN", constituent: { firstName: "Flow" } },
      include: { constituent: true },
      orderBy: { bidderNumber: "asc" },
    });
    expect(regs).toHaveLength(2);
    bidder1RegistrationId = regs.find((r) => r.constituent.lastName === "BidderOne")!.id;
    bidder2RegistrationId = regs.find((r) => r.constituent.lastName === "BidderTwo")!.id;
    expect(bidder1RegistrationId).toBeTruthy();
    expect(bidder2RegistrationId).toBeTruthy();

    await context.close();
  });

  test("bidder one places the opening bid", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/bid/${bidder1RegistrationId}`);
    await page.locator("button.flex-1").first().click();

    await expect
      .poll(async () => {
        const bid = await prisma.bid.findFirst({ where: { itemId, registrationId: bidder1RegistrationId } });
        return bid?.amountCents ?? null;
      })
      // The quick-bid button always offers current-price + one increment,
      // and the current price before any bid is the starting bid — so
      // the very first bid placed is 5,000 + 500, not the bare 5,000.
      .toBe(5_500);

    await context.close();
  });

  test("bidder two outbids bidder one", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/bid/${bidder2RegistrationId}`);
    await page.locator("button.flex-1").first().click();

    await expect
      .poll(async () => {
        const bid = await prisma.bid.findFirst({
          where: { itemId, registrationId: bidder2RegistrationId },
        });
        return bid?.amountCents ?? null;
      })
      .toBe(6_000); // bidder one's 5,500 + one more increment (500)

    // Bidder one is no longer the one leading.
    const item = await prisma.auctionItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.status).toBe("OPEN");

    await context.close();
  });

  test("admin closes the item and it's awarded to the current leader", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await loginAsAdmin(page);
    await page.goto(`/admin/events/${eventId}`);

    // Find the row for S1 specifically (several items are listed) and
    // click its own Close button, not just the first one on the page.
    const row = page.locator("tbody tr", { hasText: "Weekend at the Lake House" });
    await row.locator('button:has-text("Close")').click();

    await expect
      .poll(async () => {
        const item = await prisma.auctionItem.findUniqueOrThrow({ where: { id: itemId } });
        return item.status;
      })
      .toBe("AWARDED");

    const award = await prisma.award.findFirstOrThrow({ where: { itemId } });
    expect(award.registrationId).toBe(bidder2RegistrationId);
    expect(award.amountCents).toBe(6_000);
  });

  test("admin checks out the winner", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/events/${eventId}/checkout`);

    await page.locator("select").first().selectOption(bidder2RegistrationId);
    await expect(page.locator("text=/Weekend at the Lake House/").first()).toBeVisible();
    await expect(page.locator("text=/\\$60\\.00/").first()).toBeVisible();

    await page.click('button:has-text("Complete checkout")');
    await page.waitForURL("**/admin/receipts/**", { timeout: 15_000 });

    transactionId = page.url().split("/admin/receipts/")[1];
    expect(transactionId).toBeTruthy();
  });

  test("the receipt shows the correct amount and deductible split", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/receipts/${transactionId}`);

    await expect(page.locator("text=/\\$60\\.00/").first()).toBeVisible();

    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: { lines: true },
    });
    expect(transaction.status).toBe("PAID");
    expect(transaction.totalCents).toBe(6_000);

    const item = await prisma.auctionItem.findUniqueOrThrow({ where: { id: itemId } });
    const line = transaction.lines[0];
    expect(line.lineType).toBe("AUCTION_WIN");
    expect(line.fmvCents).toBe(item.fmvCents);
    // AUCTION_WIN deductible = max(0, amount - FMV) — see
    // src/lib/money/deductible.ts, the pure function this whole system
    // is built around.
    expect(line.deductibleCents).toBe(Math.max(0, 6_000 - (item.fmvCents ?? 0)));
  });

  test("the checkout synced to eTapestry", async () => {
    await expect
      .poll(async () => {
        const syncLog = await prisma.syncLog.findFirst({
          where: { entityType: "GIFT", localId: transactionId },
          orderBy: { createdAt: "desc" },
        });
        return syncLog?.status ?? null;
      }, { timeout: 10_000 })
      .toBe("SUCCESS");
  });
});

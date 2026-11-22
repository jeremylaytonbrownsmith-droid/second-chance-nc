import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { runCheckout } from "@/lib/checkout/checkout";

/**
 * Security regression test: two /api/admin/* routes
 * (givesmart-export and the admin receipts PDF) had no explicit role
 * check at all — they worked only because the shared proxy gate
 * (src/proxy.ts) happens to cover the whole /api/admin/* prefix, with no
 * defense-in-depth distinguishing admin from volunteer the way every
 * other /api/admin/* route does. A volunteer session (which the proxy
 * lets through, since volunteers are legitimately staff) could reach
 * both. Fixed by adding requireAdminRole() to each; this proves it and
 * keeps it proven.
 */

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "secondchance";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "localdevpassword";
const VOLUNTEER_USERNAME = process.env.VOLUNTEER_USERNAME ?? "volunteer";
const VOLUNTEER_PASSWORD = process.env.VOLUNTEER_PASSWORD ?? "localvolunteerpassword";

const prisma = new PrismaClient();

async function loginAs(page: Page, username: string, password: string) {
  await page.goto("/admin/login");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin");
}

async function statusOf(request: APIRequestContext, url: string): Promise<number> {
  // Every URL this test hits is under /api/, and src/proxy.ts always
  // answers an unauthorized /api/ request with a plain 401/403 JSON body
  // rather than a redirect (the redirect-to-login behavior is only for
  // page routes) — so no redirect-following concerns here.
  const res = await request.get(url);
  return res.status();
}

test.describe.configure({ mode: "serial" });

test.describe("admin API route auth", () => {
  let eventId: string;
  let transactionId: string;

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("set up a real transaction to fetch a receipt for", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await loginAs(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.click('button:has-text("Reset demo data")');
    await page.waitForTimeout(1500);

    const eventHref = await page.locator('a[href^="/admin/events/"]').first().getAttribute("href");
    eventId = eventHref!.split("/admin/events/")[1].split("/")[0];

    const registration = await prisma.registration.findFirstOrThrow({
      where: { eventId, status: "CHECKED_IN" },
    });
    const result = await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 1_000 }],
      method: "CASH",
      actorId: "test-setup",
    });
    transactionId = result.transaction.id;
  });

  test("a volunteer session is rejected by both routes", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, VOLUNTEER_USERNAME, VOLUNTEER_PASSWORD);

    const exportStatus = await statusOf(
      context.request,
      `/api/admin/events/${eventId}/givesmart-export`,
    );
    expect(exportStatus).toBe(403);

    const pdfStatus = await statusOf(context.request, `/api/admin/receipts/${transactionId}/pdf`);
    expect(pdfStatus).toBe(403);

    await context.close();
  });

  test("an admin session can reach both routes", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, ADMIN_USERNAME, ADMIN_PASSWORD);

    const exportStatus = await statusOf(
      context.request,
      `/api/admin/events/${eventId}/givesmart-export`,
    );
    expect(exportStatus).toBe(200);

    const pdfStatus = await statusOf(context.request, `/api/admin/receipts/${transactionId}/pdf`);
    expect(pdfStatus).toBe(200);

    await context.close();
  });

  test("no session at all is rejected (unauthenticated, not just unauthorized)", async ({ browser }) => {
    const context = await browser.newContext();
    const exportStatus = await statusOf(
      context.request,
      `/api/admin/events/${eventId}/givesmart-export`,
    );
    expect(exportStatus).toBe(401);
    await context.close();
  });
});

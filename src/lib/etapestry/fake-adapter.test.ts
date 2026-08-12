import { beforeEach, describe, expect, it } from "vitest";
import { FakeEtapestryAdapter } from "./fake-adapter";

describe("FakeEtapestryAdapter", () => {
  let adapter: FakeEtapestryAdapter;

  beforeEach(() => {
    adapter = new FakeEtapestryAdapter();
  });

  it("returns null when no account matches", async () => {
    const result = await adapter.findAccount({ email: "nobody@example.com" });
    expect(result).toBeNull();
  });

  it("creates an account and finds it again by email", async () => {
    const created = await adapter.createAccount({
      firstName: "Jamie",
      lastName: "Rivera",
      email: "jamie@example.com",
    });
    expect(created.accountRef).toBeTruthy();

    const found = await adapter.findAccount({ email: "JAMIE@example.com" });
    expect(found?.accountRef).toBe(created.accountRef);
  });

  it("finds a business account by accountName", async () => {
    const created = await adapter.createAccount({
      accountName: "Acme Vet Supply",
      email: "gifts@acmevet.example",
    });
    const found = await adapter.findAccount({ accountName: "acme vet supply" });
    expect(found?.accountRef).toBe(created.accountRef);
  });

  it("falls back to first/last name matching", async () => {
    const created = await adapter.createAccount({
      firstName: "Pat",
      lastName: "Nguyen",
    });
    const found = await adapter.findAccount({
      firstName: "pat",
      lastName: "nguyen",
    });
    expect(found?.accountRef).toBe(created.accountRef);
  });

  it("updates an existing account", async () => {
    const created = await adapter.createAccount({
      firstName: "Jamie",
      lastName: "Rivera",
    });
    const updated = await adapter.updateAccount(created.accountRef, {
      phone: "555-0100",
    });
    expect(updated.phone).toBe("555-0100");
    expect(updated.firstName).toBe("Jamie");
  });

  it("throws when updating an account that doesn't exist", async () => {
    await expect(
      adapter.updateAccount("does-not-exist", { phone: "555-0100" }),
    ).rejects.toThrow();
  });

  it("creates a gift against an existing account", async () => {
    const account = await adapter.createAccount({ firstName: "Jamie" });
    const gift = await adapter.createGift(account.accountRef, {
      amountCents: 15_000,
      giftDate: new Date("2027-04-15T00:00:00Z"),
      fund: "General",
    });
    expect(gift.giftRef).toBeTruthy();
    expect(adapter.listGifts()).toHaveLength(1);
  });

  it("refuses to create a gift for an unknown account", async () => {
    await expect(
      adapter.createGift("does-not-exist", {
        amountCents: 1_000,
        giftDate: new Date("2027-04-15T00:00:00Z"),
      }),
    ).rejects.toThrow();
  });

  it("reset() clears accounts and gifts", async () => {
    const account = await adapter.createAccount({ firstName: "Jamie" });
    await adapter.createGift(account.accountRef, {
      amountCents: 1_000,
      giftDate: new Date("2027-04-15T00:00:00Z"),
    });
    adapter.reset();
    expect(adapter.listAccounts()).toHaveLength(0);
    expect(adapter.listGifts()).toHaveLength(0);
  });
});

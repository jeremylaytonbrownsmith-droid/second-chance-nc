import type {
  EtapestryAccount,
  EtapestryAccountData,
  EtapestryAdapter,
  EtapestryGift,
  EtapestryGiftData,
  FindAccountQuery,
} from "./adapter";

/**
 * In-memory implementation of EtapestryAdapter for tests, local dev, and
 * the demo/simulation mode (Section 14). Matching is intentionally simple
 * — exact, case-insensitive email match first, then exact first+last name
 * — since the real matching logic lives on eTapestry's side once the real
 * adapter exists.
 */
export class FakeEtapestryAdapter implements EtapestryAdapter {
  private accounts = new Map<string, EtapestryAccount>();
  private gifts = new Map<string, EtapestryGift>();
  private nextAccountId = 1;
  private nextGiftId = 1;

  async findAccount(
    query: FindAccountQuery,
  ): Promise<EtapestryAccount | null> {
    const accounts = Array.from(this.accounts.values());

    if (query.email) {
      const byEmail = accounts.find(
        (a) => a.email?.toLowerCase() === query.email!.toLowerCase(),
      );
      if (byEmail) return byEmail;
    }

    if (query.accountName) {
      const byAccountName = accounts.find(
        (a) =>
          a.accountName?.toLowerCase() === query.accountName!.toLowerCase(),
      );
      if (byAccountName) return byAccountName;
    }

    if (query.firstName && query.lastName) {
      const byName = accounts.find(
        (a) =>
          a.firstName?.toLowerCase() === query.firstName!.toLowerCase() &&
          a.lastName?.toLowerCase() === query.lastName!.toLowerCase(),
      );
      if (byName) return byName;
    }

    return null;
  }

  async createAccount(data: EtapestryAccountData): Promise<EtapestryAccount> {
    const accountRef = `fake-account-${this.nextAccountId++}`;
    const account: EtapestryAccount = { accountRef, ...data };
    this.accounts.set(accountRef, account);
    return account;
  }

  async updateAccount(
    accountRef: string,
    data: Partial<EtapestryAccountData>,
  ): Promise<EtapestryAccount> {
    const existing = this.accounts.get(accountRef);
    if (!existing) {
      throw new Error(`FakeEtapestryAdapter: no account ${accountRef}`);
    }
    const updated: EtapestryAccount = { ...existing, ...data, accountRef };
    this.accounts.set(accountRef, updated);
    return updated;
  }

  async createGift(
    accountRef: string,
    gift: EtapestryGiftData,
  ): Promise<EtapestryGift> {
    if (!this.accounts.has(accountRef)) {
      throw new Error(`FakeEtapestryAdapter: no account ${accountRef}`);
    }
    const giftRef = `fake-gift-${this.nextGiftId++}`;
    const created: EtapestryGift = { giftRef, ...gift };
    this.gifts.set(giftRef, created);
    return created;
  }

  /** Test/demo helper — not part of the EtapestryAdapter interface. */
  reset(): void {
    this.accounts.clear();
    this.gifts.clear();
    this.nextAccountId = 1;
    this.nextGiftId = 1;
  }

  /** Test/demo helper — inspect what's been pushed so far. */
  listGifts(): EtapestryGift[] {
    return Array.from(this.gifts.values());
  }

  listAccounts(): EtapestryAccount[] {
    return Array.from(this.accounts.values());
  }
}

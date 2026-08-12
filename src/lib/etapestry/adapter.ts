/**
 * eTapestry adapter interface (Section 7).
 *
 * eTapestry's API is SOAP-based. Nothing else in this app should know
 * that — every caller talks to this interface, and the SOAP client lives
 * behind a single implementation of it. That keeps eTapestry a sync
 * target, not the schema (CLAUDE.md hard rule 6): swapping CRMs later
 * means writing a new adapter, not touching the application.
 *
 * The real SOAP-backed implementation isn't built yet — eTapestry API
 * access is disabled by default and the organization has to request it
 * (Section 7). Until that access exists and a sandbox database is
 * available to build against, use `FakeEtapestryAdapter` (fake-adapter.ts)
 * everywhere, including in tests.
 */

export interface EtapestryAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface EtapestryAccountData {
  firstName?: string;
  lastName?: string;
  /** Business/organization name, for business donors. */
  accountName?: string;
  email?: string;
  phone?: string;
  address?: EtapestryAddress;
}

export interface EtapestryAccount extends EtapestryAccountData {
  /** eTapestry's account ID — stored back as Constituent.etapestryAccountRef. */
  accountRef: string;
}

export interface FindAccountQuery {
  /** Prefer matching on email when present — most reliable key. */
  email?: string;
  firstName?: string;
  lastName?: string;
  accountName?: string;
}

export interface EtapestryGiftData {
  amountCents: number;
  giftDate: Date;
  fund?: string;
  campaign?: string;
  note?: string;
  /** Free text describing goods/services received, for their receipting. */
  quidProQuoDescription?: string;
}

export interface EtapestryGift extends EtapestryGiftData {
  giftRef: string;
}

/**
 * The four operations Section 7 calls out: find account, create account,
 * update account, create gift. Deliberately narrow — this is not a general
 * eTapestry client, just what the sync queue needs.
 */
export interface EtapestryAdapter {
  /**
   * Look up an existing account before creating one. eTapestry does its
   * own name/account matching on their side; call this first so we don't
   * create duplicate donor records (Section 7: "Dedupe on their side...
   * before creating anything").
   */
  findAccount(query: FindAccountQuery): Promise<EtapestryAccount | null>;

  createAccount(data: EtapestryAccountData): Promise<EtapestryAccount>;

  updateAccount(
    accountRef: string,
    data: Partial<EtapestryAccountData>,
  ): Promise<EtapestryAccount>;

  createGift(
    accountRef: string,
    gift: EtapestryGiftData,
  ): Promise<EtapestryGift>;
}

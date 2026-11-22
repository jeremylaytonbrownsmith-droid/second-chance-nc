import { prisma } from "@/lib/prisma";
import type { Constituent } from "@prisma/client";

/**
 * Pure matching rules first (no I/O, unit-tested directly), the query
 * that applies them second. Two ways two constituent records are flagged
 * as the same real person: (1) the same email address, or (2) a fuzzy
 * name match combined with the same phone number — name alone is too
 * loose (lots of "John Smith"s exist) and phone alone is too loose
 * (shared landlines), but together they're a strong signal.
 */

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Classic edit-distance DP — small inputs (names), so O(n*m) is fine. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Within a small edit distance relative to length, or one name contains
 * the other after normalizing (catches "Bob" vs "Bob Smith", a nickname
 * plus a full name, etc.). Empty names never match — nothing to compare. */
export function namesAreFuzzyMatch(nameA: string, nameB: string): boolean {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const maxLen = Math.max(a.length, b.length);
  const allowedDistance = Math.max(1, Math.floor(maxLen * 0.2));
  return levenshteinDistance(a, b) <= allowedDistance;
}

function displayName(c: Constituent): string {
  return c.isBusiness ? (c.orgName ?? "") : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
}

export type DuplicateMatchReason = "email" | "name_and_phone";

export interface DuplicateGroup {
  reason: DuplicateMatchReason;
  constituents: Constituent[];
}

/** Union-find over pairs so three-or-more records that all match each
 * other (directly or transitively) surface as one group instead of
 * several overlapping pairs on screen. */
class DisjointSet {
  private parent = new Map<string, string>();

  find(id: string): string {
    if (!this.parent.has(id)) this.parent.set(id, id);
    const p = this.parent.get(id)!;
    if (p === id) return id;
    const root = this.find(p);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

/** Active (not voided, not already merged away) constituents for an org,
 * grouped into likely-duplicate clusters. O(n^2) comparisons — fine for
 * the sizes a gala's donor list runs at; revisit if that stops being true. */
export async function findDuplicateConstituentGroups(orgId: string): Promise<DuplicateGroup[]> {
  const constituents = await prisma.constituent.findMany({
    where: { orgId, voidedAt: null, mergedIntoId: null },
  });

  const sets = new DisjointSet();
  const reasonByPairKey = new Map<string, DuplicateMatchReason>();

  for (let i = 0; i < constituents.length; i++) {
    for (let j = i + 1; j < constituents.length; j++) {
      const a = constituents[i];
      const b = constituents[j];

      const emailA = a.email?.trim().toLowerCase();
      const emailB = b.email?.trim().toLowerCase();
      const emailMatch = Boolean(emailA && emailB && emailA === emailB);

      const phoneA = a.phone ? normalizePhone(a.phone) : "";
      const phoneB = b.phone ? normalizePhone(b.phone) : "";
      const phoneMatch = Boolean(phoneA && phoneB && phoneA === phoneB);
      const nameMatch = namesAreFuzzyMatch(displayName(a), displayName(b));

      if (emailMatch || (phoneMatch && nameMatch)) {
        sets.union(a.id, b.id);
        const key = sets.find(a.id);
        // Email match is the stronger signal — prefer it as the reason
        // shown if a pair also happens to match on name+phone.
        if (emailMatch || !reasonByPairKey.has(key)) {
          reasonByPairKey.set(key, emailMatch ? "email" : "name_and_phone");
        }
      }
    }
  }

  const groups = new Map<string, Constituent[]>();
  for (const c of constituents) {
    const root = sets.find(c.id);
    if (root === c.id && !groups.has(root)) {
      // Only roots that actually unioned with something end up with >1
      // member; skip singletons below instead of checking here.
    }
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(c);
  }

  return Array.from(groups.entries())
    .filter(([, members]) => members.length > 1)
    .map(([root, members]) => ({
      reason: reasonByPairKey.get(root) ?? "name_and_phone",
      constituents: members,
    }));
}

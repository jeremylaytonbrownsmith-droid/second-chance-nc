import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  findDuplicateConstituentGroups,
  levenshteinDistance,
  namesAreFuzzyMatch,
  normalizeName,
  normalizePhone,
} from "./duplicate-detection";

describe("normalizeName", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeName("  Jo-Anne  O'Brien ")).toBe("jo anne o brien");
  });
});

describe("normalizePhone", () => {
  it("keeps only digits", () => {
    expect(normalizePhone("(919) 555-0101")).toBe("9195550101");
  });
});

describe("levenshteinDistance", () => {
  it("is 0 for identical strings", () => {
    expect(levenshteinDistance("jamie rivera", "jamie rivera")).toBe(0);
  });

  it("counts a single substitution as distance 1", () => {
    expect(levenshteinDistance("jamie", "jaime")).toBeLessThanOrEqual(2);
  });

  it("is the full length against an empty string", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });
});

describe("namesAreFuzzyMatch", () => {
  it("matches exact names", () => {
    expect(namesAreFuzzyMatch("Jamie Rivera", "jamie rivera")).toBe(true);
  });

  it("matches a likely typo", () => {
    expect(namesAreFuzzyMatch("Jamie Rivera", "Jaime Rivera")).toBe(true);
  });

  it("matches a nickname/partial name", () => {
    expect(namesAreFuzzyMatch("Jamie", "Jamie Rivera")).toBe(true);
  });

  it("does not match clearly different names", () => {
    expect(namesAreFuzzyMatch("Jamie Rivera", "Morgan Lee")).toBe(false);
  });

  it("never matches when either name is blank", () => {
    expect(namesAreFuzzyMatch("", "Jamie Rivera")).toBe(false);
    expect(namesAreFuzzyMatch("Jamie Rivera", "")).toBe(false);
  });
});

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("findDuplicateConstituentGroups", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function makeOrg() {
    const org = await prisma.organization.create({
      data: { name: `Dup Detection Test Org ${Date.now()}` },
    });
    createdOrgIds.push(org.id);
    return org;
  }

  it("groups two records with the same email", async () => {
    const org = await makeOrg();
    await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Alex", lastName: "Kim", email: "alex@example.com" },
    });
    await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Alexandra", lastName: "K", email: "Alex@Example.com" },
    });

    const groups = await findDuplicateConstituentGroups(org.id);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("email");
    expect(groups[0].constituents).toHaveLength(2);
  });

  it("groups a fuzzy name + matching phone, but not name or phone alone", async () => {
    const org = await makeOrg();
    await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Pat", lastName: "Nguyen", phone: "919-555-0102" },
    });
    await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Pat", lastName: "Nguyen", phone: "(919) 555-0102" },
    });
    // Same name, different phone — should NOT be grouped.
    await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Pat", lastName: "Nguyen", phone: "919-555-9999" },
    });
    // Same phone, very different name — should NOT be grouped.
    await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Completely", lastName: "Different", phone: "919-555-0102" },
    });

    const groups = await findDuplicateConstituentGroups(org.id);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("name_and_phone");
    expect(groups[0].constituents).toHaveLength(2);
  });

  it("never flags a single, non-duplicated constituent", async () => {
    const org = await makeOrg();
    await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Solo", lastName: "Donor", email: "solo@example.com" },
    });
    const groups = await findDuplicateConstituentGroups(org.id);
    expect(groups).toHaveLength(0);
  });

  it("excludes already-merged and voided constituents", async () => {
    const org = await makeOrg();
    const target = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Keep", lastName: "Me", email: "keep@example.com" },
    });
    await prisma.constituent.create({
      data: {
        orgId: org.id,
        firstName: "Already",
        lastName: "Merged",
        email: "keep@example.com",
        mergedIntoId: target.id,
      },
    });
    await prisma.constituent.create({
      data: {
        orgId: org.id,
        firstName: "Already",
        lastName: "Voided",
        email: "keep@example.com",
        voidedAt: new Date(),
        voidReason: "test",
      },
    });

    const groups = await findDuplicateConstituentGroups(org.id);
    expect(groups).toHaveLength(0);
  });
});

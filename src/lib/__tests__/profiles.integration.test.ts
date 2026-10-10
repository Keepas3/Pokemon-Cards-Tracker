// Runs the real services against a throwaway SQLite database (migrated from the project's own
// migrations), so "one person never sees or changes another's data" is checked where it matters.

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;
let prisma: typeof import("@/lib/prisma").prisma;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "binder-test-"));
  const url = `file:${path.join(dir, "test.db").replace(/\\/g, "/")}`;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", cwd: process.cwd() });
  vi.stubEnv("DATABASE_URL", url);
  ({ prisma } = await import("@/lib/prisma"));

  // One set with five priced cards, so ownership and "only cards I'm missing" rules have something to bite on.
  await prisma.cardSet.create({ data: { id: 9001, name: "Test Set", slug: "test-set", cardCount: 5, itemsFetchedAt: new Date() } });
  for (let n = 1; n <= 5; n++) {
    await prisma.setItem.create({
      data: {
        setId: 9001,
        externalId: 100 + n,
        name: `Card ${n}`,
        number: `00${n}/005`,
        rarity: "Common",
        kind: "CARD",
        printing: "Normal",
        marketPriceCents: 100 * n,
        lowPriceCents: 80 * n,
        priceUpdatedAt: new Date(),
      },
    });
  }
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

async function twoProfiles() {
  const { applyBootstrap } = await import("@/lib/auth/profiles");
  await applyBootstrap([
    { name: "Sam", password: "sam-password-123" },
    { name: "Alex", password: "alex-password-456" },
  ]);
  const sam = await prisma.profile.findFirstOrThrow({ where: { name: "Sam" } });
  const alex = await prisma.profile.findFirstOrThrow({ where: { name: "Alex" } });
  return { sam, alex };
}

describe("profiles", () => {
  it("hands the migrated first profile to the first name and creates the next", async () => {
    const before = await prisma.profile.findMany();
    expect(before.map((p) => p.id)).toContain("owner");
    expect(before.find((p) => p.id === "owner")?.passwordHash).toBe("");

    const { sam, alex } = await twoProfiles();
    expect(sam.id).toBe("owner"); // the existing data's profile took the name
    expect(alex.id).not.toBe("owner");

    const { verifyPassword } = await import("@/lib/auth/password");
    expect(await verifyPassword("sam-password-123", sam.passwordHash)).toBe(true);
    expect(await verifyPassword("sam-password-123", alex.passwordHash)).toBe(false);
    expect(await verifyPassword("alex-password-456", alex.passwordHash)).toBe(true);
  });

  it("BOOTSTRAP_OVERWRITE=1 is the one deliberate way to replace a saved password", async () => {
    const { bootstrapFromEnv } = await import("@/lib/auth/profiles");
    const { verifyPassword } = await import("@/lib/auth/password");
    const env = { BOOTSTRAP_PROFILES: "Alex:a-brand-new-password" };

    await bootstrapFromEnv(env); // no flag: ignored
    let alex = await prisma.profile.findFirstOrThrow({ where: { name: "Alex" } });
    expect(await verifyPassword("alex-password-456", alex.passwordHash)).toBe(true);

    await bootstrapFromEnv({ ...env, BOOTSTRAP_OVERWRITE: "1" });
    alex = await prisma.profile.findFirstOrThrow({ where: { name: "Alex" } });
    expect(await verifyPassword("a-brand-new-password", alex.passwordHash)).toBe(true);
    expect(await verifyPassword("alex-password-456", alex.passwordHash)).toBe(false);

    // Put it back for the tests that follow.
    await bootstrapFromEnv({ BOOTSTRAP_PROFILES: "Alex:alex-password-456", BOOTSTRAP_OVERWRITE: "1" });
    const sam = await prisma.profile.findFirstOrThrow({ where: { name: "Sam" } });
    expect(await verifyPassword("sam-password-123", sam.passwordHash)).toBe(true); // Sam wasn't named, so untouched
  });

  it("running the bootstrap again changes nothing and never replaces a password", async () => {
    const { applyBootstrap } = await import("@/lib/auth/profiles");
    const before = await prisma.profile.findMany({ orderBy: { name: "asc" } });
    expect(await applyBootstrap([{ name: "Sam", password: "a-different-password" }])).toEqual([]);
    const after = await prisma.profile.findMany({ orderBy: { name: "asc" } });
    expect(after.map((p) => p.passwordHash)).toEqual(before.map((p) => p.passwordHash));
  });
});

describe("collections are separate", () => {
  it("one person's owned cards never show up for the other", async () => {
    const { sam, alex } = await twoProfiles();
    const { setOwned, loadCollectionSet } = await import("@/lib/collection/service");

    const done = await setOwned(sam.id, { setId: 9001, number: "002/005", quantity: 3 });
    expect(done.status).toBe("ok");

    const samPage = await loadCollectionSet(sam.id, "test-set");
    const alexPage = await loadCollectionSet(alex.id, "test-set");
    expect(samPage!.cards.find((c) => c.key === "2")?.owned).toBe(3);
    expect(alexPage!.cards.find((c) => c.key === "2")?.owned).toBe(0);
    expect(samPage!.summary.ownedCards).toBe(1);
    expect(alexPage!.summary.ownedCards).toBe(0);
  });

  it("each person's count for the same card is their own, and removing one leaves the other", async () => {
    const { sam, alex } = await twoProfiles();
    const { setOwned, loadCollectionSet } = await import("@/lib/collection/service");

    await setOwned(alex.id, { setId: 9001, number: "002/005", quantity: 1 });
    await setOwned(sam.id, { setId: 9001, number: "002/005", quantity: 0 }); // Sam gives it up

    expect((await loadCollectionSet(sam.id, "test-set"))!.cards.find((c) => c.key === "2")?.owned).toBe(0);
    expect((await loadCollectionSet(alex.id, "test-set"))!.cards.find((c) => c.key === "2")?.owned).toBe(1);
  });

  it("refuses a card that isn't in the set, for anyone", async () => {
    const { sam } = await twoProfiles();
    const { setOwned } = await import("@/lib/collection/service");
    expect((await setOwned(sam.id, { setId: 9001, number: "099/005", quantity: 1 })).status).toBe("no-card");
    expect((await setOwned(sam.id, { setId: 123456, number: "001/005", quantity: 1 })).status).toBe("no-set");
  });
});

describe("alert rules belong to their owner", () => {
  it("lists, reads and changes only your own rules", async () => {
    const { sam, alex } = await twoProfiles();
    const { listSmartWatches, getSmartWatch } = await import("@/lib/smartWatch/dto");
    const watch = await prisma.smartWatch.create({
      data: { profileId: sam.id, name: "Cheap commons", setId: 9001, kind: "CARD", maxPriceCents: 300 },
    });

    expect((await listSmartWatches(sam.id)).map((w) => w.id)).toContain(watch.id);
    expect((await listSmartWatches(alex.id)).map((w) => w.id)).not.toContain(watch.id);
    expect(await getSmartWatch(alex.id, watch.id)).toBeNull();
    expect(await getSmartWatch(sam.id, watch.id)).not.toBeNull();
  });

  it("'only cards I don't own' is judged against each rule owner's own collection", async () => {
    const { sam, alex } = await twoProfiles();
    const { setOwned } = await import("@/lib/collection/service");
    const { evaluateSmartWatchesForSet } = await import("@/lib/smartWatch/service");

    // Start clean for this test.
    await prisma.smartWatch.deleteMany({});
    await prisma.ownedCard.deleteMany({});
    await setOwned(sam.id, { setId: 9001, number: "001/005", quantity: 1 }); // Sam owns #1; Alex owns nothing

    const rule = (profileId: string) =>
      prisma.smartWatch.create({ data: { profileId, name: "Missing cheap", setId: 9001, kind: "CARD", onlyMissing: true, maxPriceCents: 300 } });
    const samRule = await rule(sam.id);
    const alexRule = await rule(alex.id);

    await evaluateSmartWatchesForSet(9001);

    const matched = async (id: string) => (await prisma.smartWatchMatch.findMany({ where: { smartWatchId: id } })).map((m) => m.name).sort();
    // $1, $2 and $3 cards are under the $3 limit. Sam already has #1; Alex has none of them.
    expect(await matched(samRule.id)).toEqual(["Card 2", "Card 3"]);
    expect(await matched(alexRule.id)).toEqual(["Card 1", "Card 2", "Card 3"]);
  });
});

describe("tracked cards", () => {
  const candidate = {
    name: "Test Pikachu",
    setName: "Test Set",
    number: "001/005",
    imageUrl: null,
    provider: "TCGAPI_DEV" as const,
    externalId: "555",
    variant: "Normal",
    priceCents: 500,
    lowPriceCents: 400,
    url: "https://www.tcgplayer.com/product/555",
  };

  it("two people can follow the same card with separate alerts, and it goes only when nobody follows it", async () => {
    const { sam, alex } = await twoProfiles();
    const { trackCard, setThreshold, listTrackedCards, untrackCard, tracksCard } = await import("@/lib/cards/tracking");

    const a = await trackCard(sam.id, candidate);
    const b = await trackCard(alex.id, candidate);
    expect(b.id).toBe(a.id); // one shared card, one price check for both
    expect(await prisma.cardPriceSource.count({ where: { externalId: "555" } })).toBe(1);

    await setThreshold(sam.id, a.id, 450);
    expect((await listTrackedCards(sam.id, { alertsOnly: true })).map((c) => c.id)).toEqual([a.id]);
    expect(await listTrackedCards(alex.id, { alertsOnly: true })).toEqual([]); // Alex follows it, no alert
    expect((await listTrackedCards(alex.id)).map((c) => c.watchlistEntry)).toEqual([null]);

    // A change by Alex doesn't touch Sam's limit.
    await setThreshold(alex.id, a.id, 300);
    expect((await listTrackedCards(sam.id))[0].watchlistEntry?.thresholdCents).toBe(450);

    expect(await untrackCard(sam.id, a.id)).toBe(true);
    expect(await tracksCard(sam.id, a.id)).toBe(false);
    expect(await prisma.card.count({ where: { id: a.id } })).toBe(1); // Alex still has it
    expect(await untrackCard(alex.id, a.id)).toBe(true);
    expect(await prisma.card.count({ where: { id: a.id } })).toBe(0); // now nobody does
    expect(await untrackCard(alex.id, a.id)).toBe(false);
  });
});

describe("collecting by Pokémon", () => {
  // What TCGdex would return for Pokédex #6: two cards in our test set (paired with an official set
  // called "tset"), plus one in a set we can't track.
  const dexResponse = {
    name: 6,
    cards: [
      { id: "tset-002", localId: "002", name: "Charizard" },
      { id: "tset-004", localId: "004", name: "Charizard ex" },
      { id: "digital-001", localId: "001", name: "Charizard (digital)" },
    ],
  };
  let fetches = 0;
  let failing = false;

  beforeAll(async () => {
    await prisma.officialSet.create({
      data: { id: "tset", name: "Test Set (official)", seriesId: "s", seriesName: "S", totalCards: 5, officialCards: 5, cardSetId: 9001, releaseDate: new Date("2026-01-01") },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetches++;
        if (failing) throw new Error("network down");
        expect(String(url)).toContain("/dex-ids/6");
        return new Response(JSON.stringify(dexResponse), { status: 200 });
      }),
    );
  });
  afterAll(() => vi.unstubAllGlobals());

  it("lists a Pokémon's cards across sets, pricing and splitting off the ones we can't track", async () => {
    const { sam } = await twoProfiles();
    const { loadPokemon } = await import("@/lib/pokedex/service");
    const page = await loadPokemon(sam.id, 6, { fetch: true });

    expect(page).toMatchObject({ dexId: 6, name: "Charizard", generation: 1, followed: false, error: null });
    expect(page!.cards.map((c) => [c.setName, c.name, c.priceCents, c.owned])).toEqual([
      ["Test Set (official)", "Charizard", 200, 0], // #2 costs $2.00
      ["Test Set (official)", "Charizard ex", 400, 0], // #4 costs $4.00
    ]);
    expect(page!.cards[0]).toMatchObject({ setId: 9001, setSlug: "test-set", number: "002/005", key: "9001|2" });
    expect(page!.untracked.map((c) => c.name)).toEqual(["Charizard (digital)"]);
    expect(page!.summary).toMatchObject({ totalCards: 2, ownedCards: 0 });
  });

  it("keeps the list for a week instead of asking TCGdex every time", async () => {
    const { sam } = await twoProfiles();
    const { loadPokemon } = await import("@/lib/pokedex/service");
    const before = fetches;
    await loadPokemon(sam.id, 6, { fetch: true });
    await loadPokemon(sam.id, 6, { fetch: true });
    expect(fetches).toBe(before); // served from the cache

    // Never touches the network when asked not to (e.g. building the gallery).
    await prisma.dexCache.update({ where: { dexId: 6 }, data: { fetchedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } });
    await loadPokemon(sam.id, 6, { fetch: false });
    expect(fetches).toBe(before);
  });

  it("owning a card here is the same ownership as on the set page, and only for that person", async () => {
    const { sam, alex } = await twoProfiles();
    const { loadPokemon } = await import("@/lib/pokedex/service");
    const { setOwned, loadCollectionSet } = await import("@/lib/collection/service");
    await prisma.ownedCard.deleteMany({});

    // Sam ticks off Charizard #2 using exactly what the Pokémon page sends: its set id and printed number.
    const card = (await loadPokemon(sam.id, 6, { fetch: false }))!.cards[0];
    expect((await setOwned(sam.id, { setId: card.setId!, number: card.number, quantity: 1 })).status).toBe("ok");

    expect((await loadPokemon(sam.id, 6, { fetch: false }))!.cards[0].owned).toBe(1);
    expect((await loadPokemon(alex.id, 6, { fetch: false }))!.cards[0].owned).toBe(0);
    // …and it shows on the set page too.
    expect((await loadCollectionSet(sam.id, "test-set"))!.cards.find((c) => c.key === "2")?.owned).toBe(1);
    expect((await loadPokemon(sam.id, 6, { fetch: false }))!.summary).toMatchObject({ ownedCards: 1, totalCards: 2, percent: 50 });
  });

  it("following is per person, and the gallery shows progress only for what you follow", async () => {
    const { sam, alex } = await twoProfiles();
    const { setFollowed, loadPokemonGallery } = await import("@/lib/pokedex/service");

    expect(await setFollowed(sam.id, 6, true)).toBe(true);
    expect(await setFollowed(sam.id, 5000, true)).toBe(false); // not a Pokémon

    const samGallery = await loadPokemonGallery(sam.id);
    const alexGallery = await loadPokemonGallery(alex.id);
    expect(samGallery.species).toHaveLength(1025);
    expect(samGallery.species[5]).toMatchObject({ dexId: 6, name: "Charizard", followed: true, totalCards: 2, ownedCards: 1, percent: 50 });
    expect(samGallery.totals).toMatchObject({ followed: 1, cardsOwned: 1, complete: 0 });
    expect(alexGallery.species[5]).toMatchObject({ followed: false, totalCards: null });
    expect(alexGallery.totals.followed).toBe(0);

    await setFollowed(sam.id, 6, false);
    expect((await loadPokemonGallery(sam.id)).species[5].followed).toBe(false);
  });

  it("falls back to the saved list, with a message, when TCGdex can't be reached", async () => {
    const { sam } = await twoProfiles();
    const { loadPokemon } = await import("@/lib/pokedex/service");
    // Make the saved list a month old so a fetch is attempted — and fails.
    await prisma.dexCache.update({ where: { dexId: 6 }, data: { fetchedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } });
    failing = true;
    const page = await loadPokemon(sam.id, 6, { fetch: true });
    failing = false;
    expect(page!.cards).toHaveLength(2); // still shows what was saved
    expect(page!.error).toMatch(/Couldn't reach the card catalog/);
  });

  it("says so for a Pokémon with nothing saved and no connection", async () => {
    const { sam } = await twoProfiles();
    const { loadPokemon } = await import("@/lib/pokedex/service");
    failing = true;
    const page = await loadPokemon(sam.id, 7, { fetch: true });
    failing = false;
    expect(page!.cards).toEqual([]);
    expect(page!.error).toMatch(/nothing yet/);
    expect(await loadPokemon(sam.id, 5000, { fetch: true })).toBeNull();
  });
});

describe("which sets the background fill refreshes first", () => {
  it("includes the sets anyone is collecting, and those with an alert, and nothing else", async () => {
    const { sam } = await twoProfiles();
    const { prioritySetIds } = await import("@/lib/sets/setsService");
    await prisma.ownedCard.deleteMany({});
    await prisma.smartWatch.deleteMany({});
    await prisma.cardSet.upsert({ where: { id: 9002 }, update: {}, create: { id: 9002, name: "Other Set", slug: "other-set", cardCount: 3 } });
    await prisma.cardSet.upsert({ where: { id: 9003 }, update: {}, create: { id: 9003, name: "Untouched Set", slug: "untouched-set", cardCount: 3 } });

    expect([...(await prioritySetIds())]).toEqual([]);

    await prisma.ownedCard.create({ data: { profileId: sam.id, setId: 9001, numberKey: "1", number: "001/005", name: "Card 1", quantity: 1 } });
    await prisma.smartWatch.create({ data: { profileId: sam.id, name: "alert", setId: 9002, maxPriceCents: 100 } });
    expect([...(await prioritySetIds())].sort()).toEqual([9001, 9002]);

    // A paused alert doesn't count.
    await prisma.smartWatch.updateMany({ data: { enabled: false } });
    expect([...(await prioritySetIds())]).toEqual([9001]);
  });
});

describe("deals on cards you're missing", () => {
  const item = (externalId: number, number: string | null, name: string, market: number, low: number, kind: "CARD" | "SEALED" = "CARD", printing = "Normal") => ({
    setId: 9100,
    externalId,
    name,
    number,
    rarity: kind === "CARD" ? "Rare" : null,
    kind,
    printing,
    marketPriceCents: market,
    lowPriceCents: low,
    priceUpdatedAt: new Date(),
  });

  beforeAll(async () => {
    await prisma.cardSet.upsert({ where: { id: 9100 }, update: {}, create: { id: 9100, name: "Deal Set", slug: "deal-set", cardCount: 6, itemsFetchedAt: new Date() } });
    await prisma.setItem.createMany({
      data: [
        item(1, "001/006", "Big Deal", 2000, 1200), // 40% / $8
        item(2, "002/006", "Tiny Gap", 500, 450), // 10%
        item(3, "003/006", "Dear Card", 3000, 2900), // 3%
        item(4, "004/006", "Owned Bargain", 1500, 600), // a deal, but Sam owns it
        item(5, "005/006", "Printing Deal", 1000, 900), // Normal: 10% …
        item(5, "005/006", "Printing Deal", 1000, 500, "CARD", "Reverse Holofoil"), // … but the reverse holo is 50% off
        item(6, null, "Sealed Box", 9000, 3000, "SEALED"), // not a card, never a deal
      ],
    });
  });

  it("finds cards you're missing, from the cheapest printing, and never boxes or cards you own", async () => {
    const { sam } = await twoProfiles();
    const { loadDeals } = await import("@/lib/deals/service");
    await prisma.ownedCard.deleteMany({});
    await prisma.ownedCard.create({ data: { profileId: sam.id, setId: 9100, numberKey: "4", number: "004/006", name: "Owned Bargain", quantity: 1 } });

    const { deals, found, setsConsidered } = await loadDeals(sam.id, { scope: "mine" });
    expect(deals.map((d) => d.name)).toEqual(["Big Deal", "Printing Deal"]); // $8 then $5
    expect(deals[1]).toMatchObject({ lowCents: 500, marketCents: 1000, savingsPct: 0.5, suspicious: false, setSlug: "deal-set", ownedInSet: 1 });
    expect(found).toBe(2);
    expect(setsConsidered).toBe(1);
  });

  it("'mine' only looks at the sets you've started (and Pokémon you follow); 'all' looks everywhere", async () => {
    const { sam, alex } = await twoProfiles();
    const { loadDeals } = await import("@/lib/deals/service");

    const noneYet = await loadDeals(alex.id, { scope: "mine" });
    expect(noneYet.deals).toEqual([]);
    expect(noneYet.note).toMatch(/Mark a few cards/);

    const everything = await loadDeals(alex.id, { scope: "all" });
    expect(everything.deals.map((d) => d.name)).toEqual(["Owned Bargain", "Big Deal", "Printing Deal"]); // Alex owns nothing, so #4 ($9 off) is a deal for Alex, ahead of $8 and $5
    // Sam's owned card is Sam's alone.
    expect((await loadDeals(sam.id, { scope: "all" })).deals.map((d) => d.name)).not.toContain("Owned Bargain");
  });

  it("lists a suspiciously low listing last, and keeps it out of the digest", async () => {
    const { sam } = await twoProfiles();
    const { loadDeals, newDealsForDigest } = await import("@/lib/deals/service");
    await prisma.setItem.create({ data: item(20, "020/006", "Glitch Card", 100000, 400) }); // 99.6% off
    try {
      const names = (await loadDeals(sam.id, { scope: "all" })).deals.map((d) => d.name);
      expect(names.at(-1)).toBe("Glitch Card");
      expect(names.indexOf("Glitch Card")).toBeGreaterThan(names.indexOf("Big Deal"));
      expect((await loadDeals(sam.id, { scope: "all" })).deals.at(-1)).toMatchObject({ suspicious: true });
      expect((await newDealsForDigest(sam.id)).map((d) => d.name)).not.toContain("Glitch Card");
    } finally {
      await prisma.setItem.deleteMany({ where: { setId: 9100, externalId: 20 } });
    }
  });

  it("respects the thresholds it's given", async () => {
    const { alex } = await twoProfiles();
    const { loadDeals } = await import("@/lib/deals/service");
    const strict = await loadDeals(alex.id, { scope: "all", thresholds: { minPct: 0.5, minSavingsCents: 100 } });
    expect(strict.deals.map((d) => d.name)).toEqual(["Owned Bargain", "Printing Deal"]); // 60% and 50%
    const loose = await loadDeals(alex.id, { scope: "all", thresholds: { minPct: 0.05, minSavingsCents: 50 } });
    expect(loose.deals.map((d) => d.name)).toContain("Tiny Gap");
  });

  it("the digest mentions a deal once, and again only if it gets cheaper", async () => {
    const { sam } = await twoProfiles();
    const { newDealsForDigest, markDealsNoticed } = await import("@/lib/deals/service");
    await prisma.dealNotice.deleteMany({});

    const first = await newDealsForDigest(sam.id);
    expect(first.map((d) => d.name)).toEqual(["Big Deal", "Printing Deal"]);

    await markDealsNoticed(sam.id, first);
    expect(await newDealsForDigest(sam.id)).toEqual([]); // already told

    // Big Deal drops from $12.00 to $10.00 (more than 10% cheaper): worth saying again.
    await prisma.setItem.updateMany({ where: { setId: 9100, externalId: 1 }, data: { lowPriceCents: 1000 } });
    expect((await newDealsForDigest(sam.id)).map((d) => d.name)).toEqual(["Big Deal"]);

    // A different person hasn't been told about any of it.
    const { alex } = await twoProfiles();
    await prisma.ownedCard.create({ data: { profileId: alex.id, setId: 9100, numberKey: "2", number: "002/006", name: "Tiny Gap", quantity: 1 } });
    // (Big Deal is $10 off by now, so it leads.)
    expect((await newDealsForDigest(alex.id)).map((d) => d.name)).toEqual(["Big Deal", "Owned Bargain", "Printing Deal"]);
  });
});

describe("backup and restore", () => {
  it("a backup of one person restores into another, adding only what's missing or higher", async () => {
    const { sam, alex } = await twoProfiles();
    const { buildExport, importProfileData } = await import("@/lib/backup/profileDataService");
    const { parseImport } = await import("@/lib/backup/profileData");
    const { trackCard, setThreshold, listTrackedCards } = await import("@/lib/cards/tracking");

    // Sam's data: two owned cards, a followed Pokémon, a watched card with an alert, and an alert rule.
    await prisma.ownedCard.deleteMany({});
    await prisma.smartWatch.deleteMany({});
    await prisma.ownedCard.createMany({
      data: [
        { profileId: sam.id, setId: 9001, numberKey: "1", number: "001/005", name: "Card 1", quantity: 2 },
        { profileId: sam.id, setId: 9001, numberKey: "3", number: "003/005", name: "Card 3", quantity: 1 },
      ],
    });
    await prisma.followedPokemon.deleteMany({});
    await prisma.followedPokemon.create({ data: { profileId: sam.id, dexId: 6 } });
    const watched = await trackCard(sam.id, { name: "Backup Pikachu", setName: "Test Set", number: "009/009", imageUrl: null, provider: "TCGAPI_DEV", externalId: "9090", variant: "Normal", priceCents: 700, lowPriceCents: 600, url: "https://www.tcgplayer.com/product/9090" });
    await setThreshold(sam.id, watched.id, 650);
    await prisma.smartWatch.create({ data: { profileId: sam.id, name: "Cheap cards", setId: 9001, kind: "CARD", onlyMissing: true, maxPriceCents: 300 } });

    const exported = await buildExport(sam, new Date("2026-10-10T12:00:00Z"));
    expect(exported).toMatchObject({ app: "binder", version: 1, profile: "Sam" });
    expect(exported.owned.map((o) => [o.setId, o.number, o.quantity])).toEqual([[9001, "001/005", 2], [9001, "003/005", 1]]);
    expect(exported.followedPokemon).toEqual([6]);
    expect(exported.watchedCards[0]).toMatchObject({ externalId: "9090", thresholdCents: 650 });
    expect(exported.alertRules[0]).toMatchObject({ setId: 9001, onlyMissing: true });

    // Through a real file: serialise, read back, validate.
    const parsed = parseImport(JSON.parse(JSON.stringify(exported)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Alex already has 5 of card 1 (more than the backup's 2) and nothing else.
    await prisma.ownedCard.create({ data: { profileId: alex.id, setId: 9001, numberKey: "1", number: "001/005", name: "Card 1", quantity: 5 } });
    await prisma.followedPokemon.deleteMany({ where: { profileId: alex.id } });
    const result = await importProfileData(alex.id, parsed.value);

    expect(result.owned).toEqual({ added: 1, raised: 0, unchanged: 1, unknownSet: 0 });
    expect(result.followedPokemon).toBe(1);
    expect(result.watchedCards).toBe(1);
    expect(result.alertRules).toEqual({ added: 1, skipped: 0 });

    const alexOwned = await prisma.ownedCard.findMany({ where: { profileId: alex.id }, orderBy: { numberKey: "asc" } });
    expect(alexOwned.map((o) => [o.numberKey, o.quantity])).toEqual([["1", 5], ["3", 1]]); // card 1 kept its higher count
    expect((await listTrackedCards(alex.id, { alertsOnly: true }))[0].watchlistEntry?.thresholdCents).toBe(650);
    expect(await prisma.smartWatch.count({ where: { profileId: alex.id, name: "Cheap cards" } })).toBe(1);
    // Sam's own data is untouched by Alex's restore.
    expect(await prisma.ownedCard.count({ where: { profileId: sam.id } })).toBe(2);

    // Doing it again changes nothing.
    const again = await importProfileData(alex.id, parsed.value);
    expect(again.owned).toEqual({ added: 0, raised: 0, unchanged: 2, unknownSet: 0 });
    expect(again.followedPokemon).toBe(0);
    expect(again.alertRules).toEqual({ added: 0, skipped: 1 });
    expect(await prisma.ownedCard.count({ where: { profileId: alex.id } })).toBe(2);
  });

  it("raises a lower count, and skips sets this install doesn't have", async () => {
    const { alex } = await twoProfiles();
    const { importProfileData } = await import("@/lib/backup/profileDataService");
    const file = { app: "binder" as const, version: 1 as const, exportedAt: "2026-10-10T00:00:00Z", profile: "x", owned: [{ setId: 9001, setName: "T", number: "003/005", name: "Card 3", quantity: 4 }, { setId: 424242, setName: "Nowhere", number: "001/001", name: "Ghost", quantity: 1 }], followedPokemon: [], watchedCards: [], alertRules: [{ setId: 9001, name: "Needs prices", kind: "CARD" as const, rarity: null, query: null, onlyMissing: false, maxPriceCents: 111, enabled: true }] };
    await prisma.cardSet.update({ where: { id: 9001 }, data: { itemsFetchedAt: null } }); // prices not loaded here yet
    const result = await importProfileData(alex.id, file);
    await prisma.cardSet.update({ where: { id: 9001 }, data: { itemsFetchedAt: new Date() } });

    expect(result.owned).toMatchObject({ raised: 1, unknownSet: 1, added: 0 });
    expect((await prisma.ownedCard.findFirstOrThrow({ where: { profileId: alex.id, numberKey: "3" } })).quantity).toBe(4);
    expect(result.alertRules).toEqual({ added: 0, skipped: 1 }); // a rule needs the set's prices, as when made by hand
  });
});

describe("database snapshot", () => {
  it("writes a readable copy once a day, not before 3 a.m., and keeps only the newest seven", async () => {
    const { takeSnapshot, SNAPSHOT_KEEP } = await import("@/lib/backup/snapshot");
    const Database = (await import("better-sqlite3")).default;
    const fs = await import("node:fs");
    const backups = path.join(dir, "backups");
    const env = { ...process.env, BACKUP_DIR: backups };

    expect((await takeSnapshot({ now: new Date(2026, 9, 1, 2, 0), env })).status).toBe("not-due"); // too early in the day
    expect(fs.existsSync(backups)).toBe(false);

    const first = await takeSnapshot({ now: new Date(2026, 9, 1, 4, 0), env });
    expect(first).toMatchObject({ status: "taken", pruned: 0 });
    expect((await takeSnapshot({ now: new Date(2026, 9, 1, 5, 0), env })).status).toBe("exists"); // already have today's

    // A real, openable database with the data in it.
    const copy = new Database(path.join(backups, "binder-2026-10-01.db"), { readonly: true });
    expect((copy.prepare("select count(*) n from Profile").get() as { n: number }).n).toBeGreaterThanOrEqual(2);
    expect((copy.prepare("select count(*) n from CardSet").get() as { n: number }).n).toBeGreaterThanOrEqual(3);
    copy.close();

    // Ten more days: only the newest seven remain, and no half-written files are left behind.
    for (let day = 2; day <= 10; day++) await takeSnapshot({ now: new Date(2026, 9, day, 4, 0), env });
    const files = fs.readdirSync(backups).sort();
    expect(files).toHaveLength(SNAPSHOT_KEEP);
    expect(files[0]).toBe("binder-2026-10-04.db");
    expect(files.at(-1)).toBe("binder-2026-10-10.db");
    expect(files.some((f) => f.endsWith(".partial"))).toBe(false);

    // Not a file database: nothing to do.
    expect((await takeSnapshot({ now: new Date(2026, 9, 11, 4, 0), env: { DATABASE_URL: "postgres://x" } })).status).toBe("no-file-db");
  });
});

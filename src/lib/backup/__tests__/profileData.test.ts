import { describe, expect, it } from "vitest";
import { EXPORT_APP, EXPORT_VERSION, exportFileName, parseImport } from "../profileData";

const file = (over: Record<string, unknown> = {}) => ({
  app: EXPORT_APP,
  version: EXPORT_VERSION,
  exportedAt: "2026-10-10T12:00:00.000Z",
  profile: "Sam",
  owned: [{ setId: 5500047, setName: "Perfect Order", number: "070/088", name: "Mew ex", quantity: 2 }],
  followedPokemon: [6, 25],
  watchedCards: [
    { provider: "TCGAPI_DEV", externalId: "555", variant: "Normal", name: "Pikachu", setName: "Set", number: "001/005", imageUrl: null, url: "https://www.tcgplayer.com/product/555", thresholdCents: 450 },
  ],
  alertRules: [{ setId: 5500047, name: "Cheap SIRs", kind: "CARD", rarity: "Special Illustration Rare", query: null, onlyMissing: true, maxPriceCents: 4000, enabled: true }],
  ...over,
});

describe("parseImport", () => {
  it("reads a backup exactly as it was written", () => {
    const parsed = parseImport(file());
    expect(parsed).toMatchObject({ ok: true, skipped: [] });
    if (!parsed.ok) return;
    expect(parsed.value.owned).toHaveLength(1);
    expect(parsed.value.followedPokemon).toEqual([6, 25]);
    expect(parsed.value.watchedCards[0]).toMatchObject({ externalId: "555", thresholdCents: 450 });
    expect(parsed.value.alertRules[0]).toMatchObject({ onlyMissing: true, maxPriceCents: 4000 });
  });

  it("refuses files that aren't this app's backups, or are from another version", () => {
    expect(parseImport(null)).toMatchObject({ ok: false });
    expect(parseImport("text")).toMatchObject({ ok: false });
    expect(parseImport({ owned: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/backup from this app/) });
    expect(parseImport(file({ app: "something-else" }))).toMatchObject({ ok: false });
    expect(parseImport(file({ version: 99 }))).toMatchObject({ ok: false, error: expect.stringMatching(/version 99/) });
  });

  it("refuses lists past the limits, or lists that aren't lists", () => {
    expect(parseImport(file({ owned: "nope" }))).toMatchObject({ ok: false });
    expect(parseImport(file({ alertRules: Array.from({ length: 501 }, () => ({})) }))).toMatchObject({ ok: false });
    expect(parseImport(file({ followedPokemon: { 0: 6 } }))).toMatchObject({ ok: false });
  });

  it("skips (and reports) rows that make no sense instead of failing the whole file", () => {
    const parsed = parseImport(
      file({
        owned: [
          { setId: 1, setName: "S", number: "001/005", name: "Good", quantity: 1 },
          { setId: 1, setName: "S", number: "001/005", name: "Zero copies", quantity: 0 },
          { setId: 1, setName: "S", number: "001/005", name: "Too many", quantity: 100000 },
          { setId: "x", number: "002", name: "Bad set", quantity: 1 },
          { setId: 1, number: "", name: "No number", quantity: 1 },
          "junk",
        ],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.owned.map((o) => o.name)).toEqual(["Good"]);
    expect(parsed.skipped).toHaveLength(5);
  });

  it("drops Pokémon numbers that don't exist, and repeats", () => {
    const parsed = parseImport(file({ followedPokemon: [6, 6, 0, 1026, 2.5, "7", 25] }));
    expect(parsed.ok && parsed.value.followedPokemon).toEqual([6, 25]);
  });

  it("only takes web links for watched cards, and only tcgapi.dev ones", () => {
    const base = file().watchedCards[0];
    const parsed = parseImport(
      file({
        watchedCards: [
          base,
          { ...base, externalId: "1", url: "javascript:alert(1)" },
          { ...base, externalId: "2", imageUrl: "data:text/html,x" },
          { ...base, externalId: "3", provider: "JUSTTCG" },
          { ...base, externalId: "4", thresholdCents: -5 },
          { ...base, externalId: "5", thresholdCents: null },
        ],
      }),
    );
    expect(parsed.ok && parsed.value.watchedCards.map((w) => w.externalId)).toEqual(["555", "5"]);
    expect(parsed.ok && parsed.skipped).toHaveLength(4);
  });

  it("checks alert rules strictly", () => {
    const rule = file().alertRules[0];
    const parsed = parseImport(
      file({ alertRules: [rule, { ...rule, kind: "BOX" }, { ...rule, maxPriceCents: 0 }, { ...rule, onlyMissing: "yes" }, { ...rule, name: "" }, { ...rule, kind: null, name: "Any kind" }] }),
    );
    expect(parsed.ok && parsed.value.alertRules.map((r) => r.name)).toEqual(["Cheap SIRs", "Any kind"]);
  });

  it("an empty backup is fine", () => {
    expect(parseImport({ app: EXPORT_APP, version: EXPORT_VERSION })).toMatchObject({ ok: true, value: { owned: [], followedPokemon: [], watchedCards: [], alertRules: [] } });
  });
});

describe("exportFileName", () => {
  it("makes a safe, dated name", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(exportFileName("Sam", now)).toBe("binder-sam-2026-10-10.json");
    expect(exportFileName("  Alex & Co. ../../etc ", now)).toBe("binder-alex-co-etc-2026-10-10.json");
    expect(exportFileName("日本語", now)).toBe("binder-profile-2026-10-10.json");
    expect(exportFileName('a"b\r\nc', now)).toBe("binder-a-b-c-2026-10-10.json");
  });
});

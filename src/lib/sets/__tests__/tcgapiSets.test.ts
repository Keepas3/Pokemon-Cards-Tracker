import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SetItemKind } from "@/generated/prisma/client";
import { fetchAllSets, fetchSetItems, kindFromProductType, parseItems, parseSets } from "../tcgapiSets";

// Row shapes captured from live tcgapi.dev responses (2026-10-08).
const setRow = {
  id: 5500219,
  name: "ME: 30th Celebration",
  slug: "me-30th-celebration",
  release_date: "2026-09-16",
  card_count: 221,
  set_icon_url: "https://tcgplayer-cdn.tcgplayer.com/set_icon/24722ME30thCelebration.png",
  image_url: "https://product-images.tcgplayer.com/fit-in/400x400/704192.jpg",
};

const sealedRow = {
  id: 2162726,
  name: "30th Celebration 2-Pack Blister",
  number: null,
  rarity: null,
  tcgplayer_id: 704148,
  product_type: "Sealed Products",
  printing: "Normal",
  market_price: 56.74,
  low_price: null,
  image_url: "https://product-images.tcgplayer.com/fit-in/400x400/704148.jpg",
  price_updated_at: "2026-10-08T03:40:09.638Z",
};

const cardRow = {
  id: 2162800,
  name: "Mew - R/RGB",
  number: "R/RGB",
  rarity: "RGB Rare",
  tcgplayer_id: 704200,
  product_type: "Cards",
  printing: "Holofoil",
  market_price: 6000.27,
  low_price: 5500,
};

describe("parseSets", () => {
  it("maps a set row, keeping release date as a UTC calendar date", () => {
    const [s] = parseSets([setRow]);
    expect(s).toMatchObject({
      id: 5500219,
      name: "ME: 30th Celebration",
      slug: "me-30th-celebration",
      cardCount: 221,
      iconUrl: setRow.set_icon_url,
    });
    expect(s.releaseDate?.toISOString()).toBe("2026-09-16T00:00:00.000Z");
  });

  it("derives a slug when missing and suffixes the id on a clash", () => {
    const sets = parseSets([
      { id: 1, name: "Base Set" },
      { id: 2, name: "Base  Set!" },
    ]);
    expect(sets.map((s) => s.slug)).toEqual(["base-set", "base-set-2"]);
  });

  it("tolerates missing dates and counts, and skips malformed rows", () => {
    const sets = parseSets([
      { id: 3, name: "Mystery", release_date: null, card_count: null },
      { id: 4, name: "" },
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ releaseDate: null, cardCount: 0 });
  });
});

describe("kindFromProductType", () => {
  it("maps the two kinds we show and skips the rest", () => {
    expect(kindFromProductType("Cards")).toBe(SetItemKind.CARD);
    expect(kindFromProductType("Sealed Products")).toBe(SetItemKind.SEALED);
    expect(kindFromProductType("Accessories")).toBeNull();
    expect(kindFromProductType(null)).toBeNull();
  });
});

describe("parseItems", () => {
  it("converts prices to cents and classifies kind", () => {
    const [sealed, card] = parseItems([sealedRow, cardRow]);
    expect(sealed).toMatchObject({
      kind: SetItemKind.SEALED,
      marketPriceCents: 5674,
      lowPriceCents: null,
      tcgplayerId: 704148,
    });
    expect(card).toMatchObject({
      kind: SetItemKind.CARD,
      marketPriceCents: 600027,
      lowPriceCents: 550000,
      number: "R/RGB",
      printing: "Holofoil",
    });
  });

  it("drops rows repeated across pages and rows of unknown kind", () => {
    const items = parseItems([sealedRow, sealedRow, { ...cardRow, id: 9, product_type: "Accessories" }]);
    expect(items).toHaveLength(1);
  });

  it("keeps the same product id when printings differ", () => {
    const items = parseItems([
      { ...cardRow, printing: "Normal" },
      { ...cardRow, printing: "Holofoil" },
    ]);
    expect(items.map((i) => i.printing)).toEqual(["Normal", "Holofoil"]);
  });
});

describe("fetching (mocked HTTP)", () => {
  const originalKey = process.env.TCGAPI_DEV_API_KEY;

  beforeEach(() => {
    process.env.TCGAPI_DEV_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.TCGAPI_DEV_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  function pages(...bodies: unknown[]) {
    const fn = vi.fn();
    bodies.forEach((b) => fn.mockResolvedValueOnce({ ok: true, status: 200, json: async () => b }));
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("fetchAllSets follows has_more across pages", async () => {
    const fn = pages(
      { data: [setRow], meta: { has_more: true } },
      { data: [{ ...setRow, id: 2, name: "Other", slug: "other" }], meta: { has_more: false } },
    );
    const result = await fetchAllSets();
    expect(result.ok && result.sets.map((s) => s.id)).toEqual([5500219, 2]);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(String(fn.mock.calls[1][0])).toContain("page=2");
  });

  it("fetchSetItems pages until has_more is false and reports the request count", async () => {
    pages({ data: [sealedRow], meta: { has_more: true } }, { data: [cardRow], meta: { has_more: false } });
    const result = await fetchSetItems(5500219);
    expect(result.ok && result.requests).toBe(2);
    expect(result.ok && result.items).toHaveLength(2);
  });

  it("returns the error (not partial data) when a later page fails", async () => {
    const fn = vi.fn();
    fn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [sealedRow], meta: { has_more: true } }),
    });
    fn.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: "Daily limit reached" }) });
    vi.stubGlobal("fetch", fn);
    const result = await fetchSetItems(5500219);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Daily limit reached/);
  });

  it("says so clearly when no key is configured", async () => {
    delete process.env.TCGAPI_DEV_API_KEY;
    const result = await fetchAllSets();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/TCGAPI_DEV_API_KEY/);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tcgApiDevChecker } from "../tcgapiDev";
import {
  tcgApiDevSearchResponse,
  tcgApiDevPricesArrayResponse,
  tcgApiDevPricesSingleResponse,
  tcgApiDevMissingKeyError,
} from "../__fixtures__/tcgapiDev";

function mockFetchOnce(body: unknown, init: Partial<Response> = { ok: true, status: 200 }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    }),
  );
}

describe("tcgApiDevChecker", () => {
  const originalKey = process.env.TCGAPI_DEV_API_KEY;

  beforeEach(() => {
    process.env.TCGAPI_DEV_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.TCGAPI_DEV_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("search() maps rows to candidates with cents pricing", async () => {
    mockFetchOnce(tcgApiDevSearchResponse);
    const result = await tcgApiDevChecker.search("charizard ex");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates[0]).toMatchObject({
      externalId: "12345",
      name: "Charizard ex",
      setName: "Obsidian Flames",
      variant: "Normal",
      priceCents: 2499,
      lowPriceCents: 1950,
      imageUrl: "https://tcgplayer-cdn.tcgplayer.com/product/example.jpg",
    });
  });

  it("checkPrice() handles the array response shape (multiple printings)", async () => {
    mockFetchOnce(tcgApiDevPricesArrayResponse);
    const result = await tcgApiDevChecker.checkPrice("12345", "Normal");
    expect(result).toMatchObject({ ok: true, priceCents: 2250, lowPriceCents: 1800 });
  });

  it("checkPrice() handles the single-object response shape (one printing only)", async () => {
    mockFetchOnce(tcgApiDevPricesSingleResponse);
    const result = await tcgApiDevChecker.checkPrice("999", null);
    expect(result).toMatchObject({ ok: true, priceCents: 4250, lowPriceCents: 3500 });
  });

  it("errors clearly when no API key is configured", async () => {
    delete process.env.TCGAPI_DEV_API_KEY;
    const result = await tcgApiDevChecker.search("charizard");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/TCGAPI_DEV_API_KEY/);
  });

  it("surfaces the API's own error message on a 401", async () => {
    mockFetchOnce(tcgApiDevMissingKeyError, { ok: false, status: 401 });
    const result = await tcgApiDevChecker.search("charizard");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/API key is required/);
  });
});

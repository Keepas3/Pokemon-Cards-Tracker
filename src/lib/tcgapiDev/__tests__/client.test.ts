import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { errorText, tcgApiFetch } from "../client";

describe("errorText", () => {
  it("reads a plain string error", () => {
    expect(errorText("Daily limit reached")).toBe("Daily limit reached");
  });

  it("reads the message out of an error object", () => {
    expect(errorText({ message: "Invalid or deactivated API key.", code: "INVALID_API_KEY" })).toBe(
      "Invalid or deactivated API key.",
    );
  });

  it("returns null for anything it can't read, rather than printing [object Object]", () => {
    expect(errorText(undefined)).toBeNull();
    expect(errorText("")).toBeNull();
    expect(errorText({ code: "X" })).toBeNull();
    expect(errorText(42)).toBeNull();
  });
});

describe("tcgApiFetch error handling", () => {
  const originalKey = process.env.TCGAPI_DEV_API_KEY;

  beforeEach(() => {
    process.env.TCGAPI_DEV_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.TCGAPI_DEV_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  function respond(status: number, body: unknown) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }));
  }

  it("shows the API's message for an object-shaped error (the bad-key case)", async () => {
    respond(401, { error: { message: "Invalid or deactivated API key.", code: "INVALID_API_KEY" } });
    const result = await tcgApiFetch("/sets");
    expect(result).toEqual({ ok: false, error: "tcgapi.dev: Invalid or deactivated API key." });
  });

  it("shows the API's message for a string-shaped error", async () => {
    respond(429, { error: "Daily limit reached" });
    const result = await tcgApiFetch("/sets");
    expect(result).toEqual({ ok: false, error: "tcgapi.dev: Daily limit reached" });
  });

  it("falls back to the status code when the body has no usable message", async () => {
    respond(500, {});
    const result = await tcgApiFetch("/sets");
    expect(result).toEqual({ ok: false, error: "tcgapi.dev returned 500" });
  });
});

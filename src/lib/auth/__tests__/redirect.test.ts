import { describe, expect, it } from "vitest";
import { safeNext } from "../redirect";

describe("safeNext", () => {
  it("keeps ordinary paths on this site, query strings included", () => {
    expect(safeNext("/collection/me03-perfect-order?tab=cards")).toBe("/collection/me03-perfect-order?tab=cards");
    expect(safeNext("/browse")).toBe("/browse");
  });

  it("falls back to home for anything that could leave the site", () => {
    for (const bad of [
      "//evil.example/x",
      "https://evil.example/",
      "http://evil.example",
      "javascript:alert(1)",
      "evil.example/path",
      "/\\evil.example",
      "/ok\\path",
      "/with\nnewline",
      "",
    ]) {
      expect(safeNext(bad)).toBe("/");
    }
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });

  it("doesn't send you back to the sign-in page or into raw API output", () => {
    expect(safeNext("/unlock")).toBe("/");
    expect(safeNext("/unlock?next=/browse")).toBe("/");
    expect(safeNext("/api/collection")).toBe("/");
  });

  it("refuses absurdly long values", () => {
    expect(safeNext(`/${"a".repeat(3000)}`)).toBe("/");
  });
});

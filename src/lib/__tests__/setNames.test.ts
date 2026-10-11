import { describe, it, expect } from "vitest";
import { normalizeSetName } from "@/lib/official/setNames";

describe("normalizeSetName", () => {
  it("drops set codes and punctuation so the two data sources' names line up", () => {
    expect(normalizeSetName("ME: 30th Celebration")).toBe("30th celebration");
    expect(normalizeSetName("ME03: Perfect Order")).toBe("perfect order");
    expect(normalizeSetName("SV: Scarlet & Violet 151")).toBe("scarlet and violet 151");
    expect(normalizeSetName("Scarlet & Violet-151")).toBe("scarlet and violet 151");
  });
});

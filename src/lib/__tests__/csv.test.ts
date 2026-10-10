import { describe, expect, it } from "vitest";
import { csvCell, ownedCardsCsv } from "@/lib/backup/csv";

describe("owned cards csv", () => {
  it("quotes commas and quotes, and defuses formulas", () => {
    expect(csvCell('Pikachu, "Surfing"')).toBe('"Pikachu, ""Surfing"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("008/086")).toBe("008/086");
  });
  it("lists set, number, card and quantity with a header and BOM", () => {
    const csv = ownedCardsCsv({
      owned: [
        { setId: 1, setName: "Chaos Rising", number: "008/086", name: "Vulpix", quantity: 2 },
        { setId: 1, setName: "Chaos Rising", number: "002/086", name: "Caterpie", quantity: 1 },
      ],
    });
    expect(csv).toBe("﻿Set,Number,Card,Quantity\r\nChaos Rising,002/086,Caterpie,1\r\nChaos Rising,008/086,Vulpix,2\r\n");
  });
});

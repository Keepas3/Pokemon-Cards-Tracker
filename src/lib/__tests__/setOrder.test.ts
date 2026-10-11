import { describe, expect, it } from "vitest";
import { applySetOrder, moveItem } from "@/lib/collection/order";

describe("applySetOrder", () => {
  const sets = ["new", "mid", "old", "oldest"];
  it("leaves the default order when nothing was moved", () => {
    expect(applySetOrder(sets, () => undefined)).toEqual(sets);
  });
  it("puts moved sets after unmoved ones, in the chosen order", () => {
    const pos = new Map([["oldest", 0], ["new", 1], ["mid", 2], ["old", 3]]);
    expect(applySetOrder(sets, (s) => pos.get(s))).toEqual(["oldest", "new", "mid", "old"]);
  });
  it("shows a brand-new set before the hand-sorted ones", () => {
    const pos = new Map([["old", 0], ["mid", 1]]);
    expect(applySetOrder(["fresh", "mid", "old"], (s) => pos.get(s))).toEqual(["fresh", "old", "mid"]);
  });
});

describe("moveItem", () => {
  it("moves an item to where another is", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });
  it("ignores impossible moves", () => {
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

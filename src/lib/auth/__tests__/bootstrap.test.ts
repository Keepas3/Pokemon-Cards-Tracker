import { describe, expect, it } from "vitest";
import { cleanName, parseBootstrapEntries, planBootstrap } from "../bootstrap";

describe("parseBootstrapEntries", () => {
  it("reads the short form, splitting on the first colon only", () => {
    expect(parseBootstrapEntries("Sam:first pass word,Alex:pa:ss:word1")).toEqual([
      { name: "Sam", password: "first pass word" },
      { name: "Alex", password: "pa:ss:word1" },
    ]);
  });

  it("reads JSON, which allows commas in passwords", () => {
    expect(parseBootstrapEntries('[{"name":"Sam","password":"pass,word,1"}]')).toEqual([{ name: "Sam", password: "pass,word,1" }]);
  });

  it("drops entries that are malformed, too weak, or duplicated by name", () => {
    expect(parseBootstrapEntries("Sam:short,NoColon,:nopassword1,Sam:good password,sam:another good one")).toEqual([
      { name: "Sam", password: "good password" },
    ]);
    expect(parseBootstrapEntries("[not json")).toEqual([]);
    expect(parseBootstrapEntries("")).toEqual([]);
    expect(parseBootstrapEntries(undefined)).toEqual([]);
  });
});

describe("cleanName", () => {
  it("trims and collapses spaces, and refuses blanks, control characters and long names", () => {
    expect(cleanName("  Sam   Smith ")).toBe("Sam Smith");
    expect(cleanName("")).toBeNull();
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("a\nb")).toBeNull();
    expect(cleanName("x".repeat(41))).toBeNull();
    expect(cleanName(7)).toBeNull();
  });
});

describe("planBootstrap", () => {
  const owner = { id: "owner", name: "Owner", hasPassword: false };

  it("hands the existing, unclaimed profile (and its data) to the first name", () => {
    expect(planBootstrap([owner], [{ name: "Sam", password: "pw-sam-1234" }, { name: "Alex", password: "pw-alex-1234" }])).toEqual([
      { type: "claim", profileId: "owner", name: "Sam", password: "pw-sam-1234" },
      { type: "create", name: "Alex", password: "pw-alex-1234" },
    ]);
  });

  it("creates every profile on a fresh database", () => {
    expect(planBootstrap([], [{ name: "Sam", password: "pw-sam-1234" }])).toEqual([{ type: "create", name: "Sam", password: "pw-sam-1234" }]);
  });

  it("sets a password on a profile already given that name but still without one", () => {
    expect(planBootstrap([{ id: "p1", name: "Sam", hasPassword: false }], [{ name: "sam", password: "pw-sam-1234" }])).toEqual([
      { type: "set-password", profileId: "p1", name: "Sam", password: "pw-sam-1234" },
    ]);
  });

  it("never replaces an existing password from the environment", () => {
    const existing = [{ id: "p1", name: "Sam", hasPassword: true }];
    expect(planBootstrap(existing, [{ name: "Sam", password: "a-new-password" }])).toEqual([]);
  });

  it("replaces one only when asked to (the explicit command-line reset)", () => {
    const existing = [{ id: "p1", name: "Sam", hasPassword: true }];
    expect(planBootstrap(existing, [{ name: "Sam", password: "a-new-password" }], { overwrite: true })).toEqual([
      { type: "set-password", profileId: "p1", name: "Sam", password: "a-new-password" },
    ]);
  });

  it("does nothing once everyone is set up", () => {
    const existing = [
      { id: "p1", name: "Sam", hasPassword: true },
      { id: "p2", name: "Alex", hasPassword: true },
    ];
    expect(
      planBootstrap(existing, [
        { name: "Sam", password: "pw-sam-1234" },
        { name: "Alex", password: "pw-alex-1234" },
      ]),
    ).toEqual([]);
  });

  it("doesn't claim the same unclaimed profile twice", () => {
    const plan = planBootstrap([owner], [{ name: "A", password: "password-a-1" }, { name: "B", password: "password-b-1" }]);
    expect(plan.filter((a) => a.type === "claim")).toHaveLength(1);
    expect(plan.filter((a) => a.type === "create")).toHaveLength(1);
  });
});

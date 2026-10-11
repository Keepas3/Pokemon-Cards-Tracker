import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "../password";
import {
  SESSION_MAX_AGE_S,
  cookieOptions,
  getSessionSecret,
  isSecureRequest,
  lockProfile,
  signSession,
  switchProfile,
  unlockProfile,
  verifySession,
} from "../session";
import type { Session } from "../session";
import { clientAddress, createRateLimiter } from "../rateLimit";

const SECRET = "x".repeat(40);
const now = Date.parse("2026-10-10T12:00:00Z");
// Cheap parameters keep the tests fast; production uses the defaults.
const FAST = { N: 1024, r: 8, p: 1 };

describe("passwords", () => {
  it("accepts the right password and rejects others", async () => {
    const stored = await hashPassword("correct horse battery", FAST);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts every hash and never stores the password", async () => {
    const a = await hashPassword("same password", FAST);
    const b = await hashPassword("same password", FAST);
    expect(a).not.toEqual(b);
    expect(a).not.toContain("same password");
    expect(a.startsWith("scrypt$1024$8$1$")).toBe(true);
  });

  it("never matches an unset or damaged hash", async () => {
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$3$8$1$AAAA$AAAA")).toBe(false); // N not a power of two
    expect(await verifyPassword("anything", "scrypt$1073741824$8$1$AAAA$AAAA")).toBe(false); // absurd cost
    expect(await verifyPassword("anything", "scrypt$1024$8$1$AAAA$AAAA")).toBe(false); // wrong key length
  });

  it("treats visually identical unicode forms as the same password", async () => {
    const stored = await hashPassword("café au lait!", FAST);
    expect(await verifyPassword("café au lait!", stored)).toBe(true);
  });

  it("states what's wrong with a weak or odd password", () => {
    expect(passwordProblem("short")).toMatch(/at least 8/);
    expect(passwordProblem("x".repeat(201))).toMatch(/at most/);
    expect(passwordProblem(42)).toMatch(/text/);
    expect(passwordProblem("long enough pw")).toBeNull();
  });
});

describe("session cookie", () => {
  const base: Session = { active: "a", unlocked: ["a"], exp: Math.floor(now / 1000) + 1000 };

  it("round-trips", () => {
    expect(verifySession(signSession(base, SECRET), SECRET, now)).toEqual(base);
  });

  it("rejects a cookie signed with another secret, edited, truncated or empty", () => {
    const token = signSession(base, SECRET);
    expect(verifySession(token, "y".repeat(40), now)).toBeNull();
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...base, unlocked: ["a", "b"], active: "b" })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, SECRET, now)).toBeNull();
    expect(verifySession(`${payload}.`, SECRET, now)).toBeNull();
    expect(verifySession(payload, SECRET, now)).toBeNull();
    expect(verifySession(`${token}.extra`, SECRET, now)).toBeNull();
    expect(verifySession("", SECRET, now)).toBeNull();
    expect(verifySession(undefined, SECRET, now)).toBeNull();
    expect(verifySession("x".repeat(5000), SECRET, now)).toBeNull();
  });

  it("expires", () => {
    const token = signSession({ ...base, exp: Math.floor(now / 1000) - 1 }, SECRET);
    expect(verifySession(token, SECRET, now)).toBeNull();
  });

  it("refuses an active profile that isn't unlocked, even with a valid signature", () => {
    const token = signSession({ ...base, active: "b" }, SECRET);
    expect(verifySession(token, SECRET, now)).toBeNull();
  });

  it("unlocks, switches only between unlocked profiles, and locks", () => {
    const first = unlockProfile(null, "a", now);
    expect(first).toMatchObject({ active: "a", unlocked: ["a"] });
    expect(first.exp).toBe(Math.floor(now / 1000) + SESSION_MAX_AGE_S);

    const both = unlockProfile(first, "b", now);
    expect(both).toMatchObject({ active: "b", unlocked: ["a", "b"] });

    expect(switchProfile(both, "a")?.active).toBe("a");
    expect(switchProfile(both, "c")).toBeNull(); // locked: needs its password

    expect(lockProfile(both, "b")).toMatchObject({ active: "a", unlocked: ["a"] });
    expect(lockProfile(first, "a")).toBeNull();
  });
});

describe("session settings", () => {
  it("requires a real secret in production and falls back to a per-process one elsewhere", () => {
    expect(() => getSessionSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/SESSION_SECRET/);
    expect(() => getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "too short" } as NodeJS.ProcessEnv)).toThrow();
    expect(getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: SECRET } as NodeJS.ProcessEnv)).toBe(SECRET);
    const dev = getSessionSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(dev.length).toBeGreaterThanOrEqual(32);
    expect(getSessionSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(dev);
  });

  it("marks the cookie Secure behind HTTPS, directly or through a proxy", () => {
    expect(isSecureRequest("https://example.com/", null)).toBe(true);
    expect(isSecureRequest("http://localhost:3000/", null)).toBe(false);
    expect(isSecureRequest("http://app:8080/", "https")).toBe(true);
    expect(isSecureRequest("http://app:8080/", "http, https")).toBe(false);
    expect(cookieOptions(true)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  });
});

describe("rate limiter", () => {
  it("allows a few failures, then blocks until the oldest ages out", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    for (let i = 0; i < 3; i++) {
      expect(limiter.check("k", i).allowed).toBe(true);
      limiter.fail("k", i);
    }
    const blocked = limiter.check("k", 500);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(500);
    expect(limiter.check("k", 1001).allowed).toBe(true);
  });

  it("keeps keys apart and forgets one on success", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    limiter.fail("a", 0);
    expect(limiter.check("a", 1).allowed).toBe(false);
    expect(limiter.check("b", 1).allowed).toBe(true);
    limiter.reset("a");
    expect(limiter.check("a", 2).allowed).toBe(true);
  });
});

describe("clientAddress", () => {
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
  it("takes the first forwarded address, then x-real-ip, else unknown", () => {
    expect(clientAddress(headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    // An address the visitor invented, then the one the host's proxy added: only the latter counts.
    expect(clientAddress(headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientAddress(headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientAddress(headers({}))).toBe("unknown");
  });
});

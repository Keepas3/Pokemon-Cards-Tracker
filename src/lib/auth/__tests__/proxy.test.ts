import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE, signSession, unlockProfile } from "../session";
import { isPublicPath, proxy } from "../../../proxy";

const SECRET = "s".repeat(48);

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const cookieFor = (session = unlockProfile(null, "p1"), secret = SECRET) => `${SESSION_COOKIE}=${signSession(session, secret)}`;

function request(path: string, init: { cookie?: string; headers?: Record<string, string>; method?: string } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? "GET",
    headers: { host: "localhost:3000", ...(init.cookie ? { cookie: init.cookie } : {}), ...init.headers },
  });
}

/** NextResponse.next() marks itself with this header; everything else is a refusal or redirect. */
const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("the front door", () => {
  it("turns away API calls with no sign-in", async () => {
    const res = proxy(request("/api/collection"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/sign in/i);
  });

  it("sends page visits with no sign-in to /unlock, remembering where they were going", () => {
    const res = proxy(request("/collection/me03-perfect-order?tab=cards"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/unlock");
    expect(location.searchParams.get("next")).toBe("/collection/me03-perfect-order?tab=cards");
  });

  it("doesn't add a next= for the home page", () => {
    expect(new URL(proxy(request("/")).headers.get("location")!).search).toBe("");
  });

  it("lets a valid sign-in through, for pages and API calls", () => {
    expect(passes(proxy(request("/", { cookie: cookieFor() })))).toBe(true);
    expect(passes(proxy(request("/api/collection", { cookie: cookieFor() })))).toBe(true);
  });

  it("refuses a forged, wrongly signed or expired cookie", () => {
    expect(proxy(request("/api/collection", { cookie: cookieFor(undefined, "z".repeat(48)) })).status).toBe(401);
    expect(proxy(request("/api/collection", { cookie: `${SESSION_COOKIE}=garbage.value` })).status).toBe(401);
    const expired = { ...unlockProfile(null, "p1"), exp: 1 };
    expect(proxy(request("/api/collection", { cookie: cookieFor(expired) })).status).toBe(401);
  });

  it("leaves only the sign-in page, the profile list, the unlock call and the health check open", () => {
    for (const path of ["/unlock", "/api/health", "/api/auth/unlock", "/api/auth/profiles"]) {
      expect(isPublicPath(path)).toBe(true);
      expect(passes(proxy(request(path)))).toBe(true);
    }
    for (const path of ["/api/auth/me", "/api/auth/switch", "/api/auth/password", "/api/settings", "/api/collection", "/unlock/x", "/api/healthz"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("still blocks another website, and outside host names, even with a valid sign-in", () => {
    const cross = proxy(request("/api/settings", { cookie: cookieFor(), method: "PUT", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } }));
    expect(cross.status).toBe(403);
    const rebinding = proxy(request("/api/settings", { cookie: cookieFor(), headers: { host: "evil.example:3000" } }));
    expect(rebinding.status).toBe(403);
  });

  it("cross-site calls to the public API are blocked too (the sign-in form is same-site)", () => {
    expect(proxy(request("/api/auth/unlock", { method: "POST", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } })).status).toBe(403);
  });

  it("answers the host's health probe whatever name it uses, since it reveals nothing", () => {
    // Railway probes as healthcheck.railway.app, which isn't a name we serve.
    expect(passes(proxy(request("/api/health", { headers: { host: "healthcheck.railway.app" } })))).toBe(true);
    expect(passes(proxy(request("/api/health", { headers: { host: "203.0.113.5:8080" } })))).toBe(true);
    // Only that one path gets the exemption.
    expect(proxy(request("/api/collection", { cookie: cookieFor(), headers: { host: "healthcheck.railway.app" } })).status).toBe(403);
    expect(proxy(request("/api/healthz", { headers: { host: "healthcheck.railway.app" } })).status).toBe(403);
  });

  it("fails closed when production has no usable SESSION_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    const api = proxy(request("/api/collection", { cookie: cookieFor() }));
    expect(api.status).toBe(503);
    expect(proxy(request("/", { cookie: cookieFor() })).status).toBe(503);
    // …but the health check still answers.
    expect(passes(proxy(request("/api/health")))).toBe(true);
  });
});

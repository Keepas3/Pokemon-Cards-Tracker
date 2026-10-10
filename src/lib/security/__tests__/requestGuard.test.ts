import { describe, it, expect } from "vitest";
import { checkApiRequest, hostnameOf, parseAllowedHosts } from "../requestGuard";

const base = { host: "localhost:3000", origin: null, secFetchSite: null };

describe("hostnameOf / parseAllowedHosts", () => {
  it("strips ports and lower-cases, keeping IPv6 brackets", () => {
    expect(hostnameOf("LocalHost:3000")).toBe("localhost");
    expect(hostnameOf("127.0.0.1:3001")).toBe("127.0.0.1");
    expect(hostnameOf("[::1]:3000")).toBe("[::1]");
    expect(hostnameOf("pokemon.example.com")).toBe("pokemon.example.com");
  });

  it("reads a comma list, ignoring blanks", () => {
    expect(parseAllowedHosts("a.example.com, 192.168.1.20:3000 ,")).toEqual(["a.example.com", "192.168.1.20"]);
    expect(parseAllowedHosts(undefined)).toEqual([]);
  });
});

describe("checkApiRequest", () => {
  it("lets the app's own pages through", () => {
    expect(checkApiRequest({ ...base, origin: "http://localhost:3000", secFetchSite: "same-origin" })).toEqual({ ok: true });
    expect(checkApiRequest({ ...base, host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" })).toEqual({ ok: true });
    expect(checkApiRequest({ ...base, host: "[::1]:3000", origin: "http://[::1]:3000" })).toEqual({ ok: true });
  });

  it("lets through the address bar and plain tools like curl", () => {
    expect(checkApiRequest({ ...base, secFetchSite: "none" })).toEqual({ ok: true });
    expect(checkApiRequest(base)).toEqual({ ok: true });
  });

  it("blocks another website posting to the app (CSRF), including from another localhost port", () => {
    expect(checkApiRequest({ ...base, origin: "https://evil.example", secFetchSite: "cross-site" }).ok).toBe(false);
    expect(checkApiRequest({ ...base, origin: "http://localhost:5173", secFetchSite: "same-site" }).ok).toBe(false);
    // Even if the browser sent only an Origin:
    expect(checkApiRequest({ ...base, origin: "https://evil.example" }).ok).toBe(false);
    expect(checkApiRequest({ ...base, origin: "null" }).ok).toBe(false);
  });

  it("blocks cross-site GETs too (some GETs spend your daily API budget)", () => {
    expect(checkApiRequest({ ...base, secFetchSite: "cross-site" }).ok).toBe(false);
  });

  it("blocks DNS rebinding: an outside name that resolves to this machine", () => {
    expect(checkApiRequest({ host: "evil.example:3000", origin: "http://evil.example:3000", secFetchSite: "same-origin" }).ok).toBe(false);
    expect(checkApiRequest({ host: "192.168.1.20:3000", origin: null, secFetchSite: null }).ok).toBe(false);
    expect(checkApiRequest({ host: null, origin: null, secFetchSite: null }).ok).toBe(false);
  });

  it("honours ALLOWED_HOSTS for a name you opted in", () => {
    const allowedHosts = ["pokemon.example.com"];
    expect(checkApiRequest({ host: "pokemon.example.com", origin: "https://pokemon.example.com", secFetchSite: "same-origin", allowedHosts }).ok).toBe(true);
    expect(checkApiRequest({ host: "pokemon.example.com", origin: "https://evil.example", secFetchSite: "cross-site", allowedHosts }).ok).toBe(false);
    expect(checkApiRequest({ host: "other.example.com", origin: null, secFetchSite: null, allowedHosts }).ok).toBe(false);
  });
});

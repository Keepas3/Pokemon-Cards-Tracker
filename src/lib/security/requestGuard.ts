// Decides whether a request to /api may proceed. Sign-in (see lib/auth/) decides *who* is asking;
// this decides *where a request comes from*, which sign-in alone doesn't cover:
//
//   • the Host must be this machine (localhost / 127.0.0.1 / ::1) or one you listed in
//     ALLOWED_HOSTS. That stops DNS-rebinding, where a website points its own name at
//     127.0.0.1 so your browser will talk to the app on its behalf.
//   • a browser's cross-site signals must say the request came from this very site (or
//     from you typing the address). That stops any other web page you happen to have open
//     from changing your settings, deleting your watchlist or spending your API budget.
//
// Requests with neither header (curl, scripts, the server itself) aren't a browser being
// steered by a web page, so they pass.

export type GuardResult = { ok: true } | { ok: false; reason: string };

export interface GuardInput {
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  allowedHosts?: string[];
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** "Localhost:3000" → "localhost"; "[::1]:3000" → "[::1]". */
export function hostnameOf(hostHeader: string): string {
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(0, end + 1);
  }
  return host.split(":")[0];
}

/** ALLOWED_HOSTS="pokemon.example.com, 192.168.1.20" → lower-cased hostnames. */
export function parseAllowedHosts(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((h) => hostnameOf(h))
    .filter(Boolean);
}

export function checkApiRequest(input: GuardInput): GuardResult {
  const { host, origin, secFetchSite } = input;
  if (!host) return { ok: false, reason: "missing Host header" };

  const hostname = hostnameOf(host);
  if (!LOOPBACK.has(hostname) && !(input.allowedHosts ?? []).includes(hostname)) {
    return { ok: false, reason: "unexpected Host — this app only answers on localhost unless ALLOWED_HOSTS lists the name" };
  }

  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return { ok: false, reason: "cross-site request" };
  }

  if (origin !== null) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return { ok: false, reason: "unreadable Origin" };
    }
    if (originHost !== host.trim().toLowerCase()) return { ok: false, reason: "Origin doesn't match this site" };
  }

  return { ok: true };
}

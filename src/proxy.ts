import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkApiRequest, parseAllowedHosts } from "@/lib/security/requestGuard";
import { SESSION_COOKIE, getSessionSecret, verifySession } from "@/lib/auth/session";

const allowedHosts = parseAllowedHosts(process.env.ALLOWED_HOSTS);

const HEALTH_PATH = "/api/health";

/** The only things reachable without signing in: the sign-in page and what it needs, and the health check. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/unlock" ||
    pathname === HEALTH_PATH ||
    pathname === "/api/auth/unlock" ||
    pathname === "/api/auth/profiles"
  );
}

/**
 * The front door, for every page and API call:
 *  1. API calls must come from this site itself (not another web page, not an outside Host) —
 *     see lib/security/requestGuard.ts;
 *  2. everything except the public paths needs a valid, unexpired, correctly signed sign-in cookie
 *     (lib/auth/session.ts). Which profile a request acts as is decided later, in the route.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // The host's health probe arrives under the host's own internal name (Railway uses
  // healthcheck.railway.app), which the Host rule below would refuse. It answers { ok: true } and
  // nothing else, so it skips the checks.
  if (pathname === HEALTH_PATH) return NextResponse.next();

  if (isApi) {
    const verdict = checkApiRequest({
      host: request.headers.get("host"),
      origin: request.headers.get("origin"),
      secFetchSite: request.headers.get("sec-fetch-site"),
      allowedHosts,
    });
    if (!verdict.ok) {
      return NextResponse.json({ error: `Blocked: ${verdict.reason}.` }, { status: 403 });
    }
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  let signedIn = false;
  try {
    signedIn = verifySession(request.cookies.get(SESSION_COOKIE)?.value, getSessionSecret()) !== null;
  } catch {
    // No usable SESSION_SECRET: fail closed rather than let anything through.
    return isApi
      ? NextResponse.json({ error: "The server isn't configured for sign-in (SESSION_SECRET)." }, { status: 503 })
      : new NextResponse("The server isn't configured for sign-in (SESSION_SECRET).", { status: 503 });
  }

  if (signedIn) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt).*)"],
};

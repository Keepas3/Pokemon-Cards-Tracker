import type { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions, getSessionSecret, isSecureRequest, signSession, verifySession } from "./session";
import type { Session } from "./session";

/** The sign-in on an incoming request (for the auth routes, which have the request in hand). */
export function sessionOf(req: NextRequest): Session | null {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value, getSessionSecret());
}

/** Attach a (new) sign-in to a response, or clear it with null. */
export function setSession<T extends NextResponse>(res: T, req: NextRequest, session: Session | null): T {
  const secure = isSecureRequest(req.url, req.headers.get("x-forwarded-proto"));
  if (session) res.cookies.set(SESSION_COOKIE, signSession(session, getSessionSecret()), cookieOptions(secure));
  else res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(secure), maxAge: 0 });
  return res;
}

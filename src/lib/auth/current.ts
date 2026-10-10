// Who is making this request, for route handlers and server code. The proxy has already
// turned away requests with no valid sign-in; this loads the active profile itself.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Profile } from "@/generated/prisma/client";
import { SESSION_COOKIE, getSessionSecret, verifySession } from "./session";
import type { Session } from "./session";

/** The sign-in cookie of the current request, if valid. */
export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, getSessionSecret());
}

export type AuthResult = { ok: true; profile: Profile } | { ok: false; response: NextResponse };

const unauthorized = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });

/**
 * The active profile, or a 401 response to return. Every route that touches one person's
 * data starts with this, so one profile can never be read or changed through another's session.
 */
export async function requireProfile(): Promise<AuthResult> {
  const session = await readSession();
  if (!session?.active) return { ok: false, response: unauthorized() };
  const profile = await prisma.profile.findUnique({ where: { id: session.active } });
  // A profile that was deleted since the cookie was issued is the same as not signed in.
  if (!profile || profile.passwordHash === "") return { ok: false, response: unauthorized() };
  return { ok: true, profile };
}

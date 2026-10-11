import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionOf, setSession } from "@/lib/auth/cookie";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { authLimiters, clientAddress } from "@/lib/auth/rateLimit";
import { unlockProfile } from "@/lib/auth/session";

const WRONG = "That password isn't right.";

/**
 * Signs this device in to one profile (and makes it the active one). Wrong guesses are
 * rate-limited per address and per profile.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { profileId?: unknown; password?: unknown } | null;
  if (!body || typeof body.profileId !== "string" || typeof body.password !== "string" || body.password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Choose a profile and enter its password." }, { status: 400 });
  }

  const addressKey = `${clientAddress(req.headers)}|${body.profileId}`;
  const byAddress = authLimiters.perAddress.check(addressKey);
  const byProfile = authLimiters.perProfile.check(body.profileId);
  if (!byAddress.allowed || !byProfile.allowed) {
    const wait = Math.max(byAddress.retryAfterMs, byProfile.retryAfterMs);
    return NextResponse.json(
      { error: `Too many wrong passwords. Try again in ${Math.ceil(wait / 60000)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } },
    );
  }

  const profile = await prisma.profile.findUnique({ where: { id: body.profileId } });
  if (!profile || !(await verifyPassword(body.password, profile.passwordHash))) {
    authLimiters.perAddress.fail(addressKey);
    authLimiters.perProfile.fail(body.profileId);
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }

  authLimiters.perAddress.reset(addressKey);
  try {
    const res = NextResponse.json({ ok: true, profile: { id: profile.id, name: profile.name } });
    return setSession(res, req, unlockProfile(sessionOf(req), profile.id));
  } catch {
    // No usable SESSION_SECRET (see lib/auth/session.ts): say so instead of a bare 500.
    return NextResponse.json({ error: "Sign-in isn't set up on this site yet." }, { status: 503 });
  }
}

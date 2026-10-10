import { NextRequest, NextResponse } from "next/server";
import { sessionOf, setSession } from "@/lib/auth/cookie";
import { lockProfile } from "@/lib/auth/session";

/** Signs out of one profile on this device, or of all of them when no profileId is given. */
export async function POST(req: NextRequest) {
  const session = sessionOf(req);
  const body = (await req.json().catch(() => ({}))) as { profileId?: unknown };
  const next = session && typeof body.profileId === "string" ? lockProfile(session, body.profileId) : null;
  return setSession(NextResponse.json({ ok: true, signedOut: next === null }), req, next);
}

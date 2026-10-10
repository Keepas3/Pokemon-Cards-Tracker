import { NextRequest, NextResponse } from "next/server";
import { sessionOf, setSession } from "@/lib/auth/cookie";
import { switchProfile } from "@/lib/auth/session";

/** Switches to a profile already signed in on this device. A locked one needs its password (/api/auth/unlock). */
export async function POST(req: NextRequest) {
  const session = sessionOf(req);
  const body = (await req.json().catch(() => null)) as { profileId?: unknown } | null;
  if (!session || typeof body?.profileId !== "string") return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const next = switchProfile(session, body.profileId);
  if (!next) return NextResponse.json({ error: "That profile is locked — enter its password.", locked: true }, { status: 403 });
  return setSession(NextResponse.json({ ok: true, active: next.active }), req, next);
}

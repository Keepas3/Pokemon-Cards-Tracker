import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth/current";
import { changePassword } from "@/lib/auth/profiles";
import { authLimiters, clientAddress } from "@/lib/auth/rateLimit";

/** Changes the active profile's own password (the current one is required). */
export async function POST(req: Request) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as { currentPassword?: unknown; newPassword?: unknown } | null;
  if (typeof body?.currentPassword !== "string" || typeof body.newPassword !== "string") {
    return NextResponse.json({ error: "currentPassword and newPassword are required" }, { status: 400 });
  }

  // Guessing the current password here is guessing the login, so it shares the sign-in limits.
  const key = `${clientAddress(await headers())}|${auth.profile.id}`;
  const gate = authLimiters.perAddress.check(key);
  if (!gate.allowed) return NextResponse.json({ error: "Too many wrong passwords. Try again later." }, { status: 429 });

  const { result, problem } = await changePassword(auth.profile.id, body.currentPassword, body.newPassword);
  if (result === "wrong-password") {
    authLimiters.perAddress.fail(key);
    return NextResponse.json({ error: "The current password isn't right." }, { status: 403 });
  }
  if (result === "weak") return NextResponse.json({ error: problem }, { status: 400 });
  if (result !== "ok") return NextResponse.json({ error: "profile not found" }, { status: 404 });
  authLimiters.perAddress.reset(key);
  return NextResponse.json({ ok: true });
}

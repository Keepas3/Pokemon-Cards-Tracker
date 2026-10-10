import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/current";
import { listProfiles } from "@/lib/auth/profiles";

/** The active profile and every profile with whether it's unlocked on this device, for the switcher. */
export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profiles = (await listProfiles()).filter((p) => p.hasPassword);
  return NextResponse.json({
    active: session.active,
    profiles: profiles.map((p) => ({ id: p.id, name: p.name, unlocked: session.unlocked.includes(p.id) })),
  });
}

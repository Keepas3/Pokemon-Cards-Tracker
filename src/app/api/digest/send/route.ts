import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { sendDigest } from "@/lib/digest/send";

/** Sends the signed-in person a test digest (the last 24 hours) now. Doesn't count as today's digest. */
export async function POST() {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await sendDigest(auth.profile.id, { test: true }));
}

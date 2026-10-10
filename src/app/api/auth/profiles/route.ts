import { NextResponse } from "next/server";
import { listProfiles } from "@/lib/auth/profiles";

/** Who can sign in: names only, so the sign-in page can offer them. Public by design. */
export async function GET() {
  return NextResponse.json({ profiles: await listProfiles() });
}

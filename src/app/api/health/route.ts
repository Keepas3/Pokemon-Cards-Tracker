import { NextResponse } from "next/server";

/** For the host's health check. Reveals nothing and needs no sign-in. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

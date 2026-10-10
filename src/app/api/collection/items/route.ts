import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { parseOwned } from "@/lib/collection/input";
import { setOwned } from "@/lib/collection/service";

/**
 * Sets how many copies of one card the signed-in person owns — an absolute count, so a repeated
 * request changes nothing. Responds with the set's refreshed completion summary.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;

  const parsed = parseOwned(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const outcome = await setOwned(auth.profile.id, parsed.value);
  if (outcome.status === "no-set") return NextResponse.json({ error: "set not found" }, { status: 404 });
  if (outcome.status === "no-card") {
    return NextResponse.json({ error: "that isn't a card in this set's list" }, { status: 404 });
  }
  return NextResponse.json(outcome.result);
}

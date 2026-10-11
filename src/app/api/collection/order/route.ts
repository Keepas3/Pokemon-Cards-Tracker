import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { MAX_ORDER_SETS } from "@/lib/collection/order";
import { saveSetOrder } from "@/lib/collection/service";

/** Saves how the signed-in person has arranged a series' sets. Body: { slugs: string[] } in the order wanted. */
export async function PUT(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const body = (await req.json().catch(() => null)) as { slugs?: unknown } | null;
  const slugs = body?.slugs;
  if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > MAX_ORDER_SETS || !slugs.every((s) => typeof s === "string" && s.length <= 200)) {
    return NextResponse.json({ error: "slugs must be a list of set names" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, saved: await saveSetOrder(auth.profile.id, slugs as string[]) });
}

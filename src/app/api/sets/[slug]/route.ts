import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { loadSetDetail } from "@/lib/sets/setsService";

/** One set's cards and sealed products, from cache unless stale (or `?refresh=1`), with the signed-in person's collection. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const detail = await loadSetDetail(slug, { refresh, profileId: auth.profile.id });
  if (!detail) {
    return NextResponse.json({ error: "set not found — open Browse to load the set list first" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

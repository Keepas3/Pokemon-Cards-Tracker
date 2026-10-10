import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { loadCollectionSet } from "@/lib/collection/service";

/** One set's complete card list with what the signed-in person owns, plus its sealed products and other rows. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  const payload = await loadCollectionSet(auth.profile.id, slug);
  if (!payload) return NextResponse.json({ error: "set not found — open Browse to load the set list first" }, { status: 404 });
  return NextResponse.json(payload);
}

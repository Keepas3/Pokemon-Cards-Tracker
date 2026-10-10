import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { untrackCard } from "@/lib/cards/tracking";

/** Takes a card off the signed-in person's list (the shared card stays for anyone else still following it). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!(await untrackCard(auth.profile.id, id))) return NextResponse.json({ error: "card not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

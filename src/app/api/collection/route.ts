import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { loadGallery } from "@/lib/collection/service";

/** Every set grouped by series, with the signed-in person's progress in each. (Refreshes the card catalog index if it's over a week old.) */
export async function GET() {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await loadGallery(auth.profile.id));
}

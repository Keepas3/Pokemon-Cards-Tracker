import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { parseImport } from "@/lib/backup/profileData";
import { importProfileData } from "@/lib/backup/profileDataService";

/**
 * Merges a backup file (from /api/profile/export, here or on another install) into the signed-in
 * person's data. It only adds or raises, never deletes, so restoring is safe to repeat.
 */
export async function POST(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;

  const parsed = parseImport(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await importProfileData(auth.profile.id, parsed.value, parsed.skipped.slice(0, 20));
  return NextResponse.json({ ok: true, result });
}

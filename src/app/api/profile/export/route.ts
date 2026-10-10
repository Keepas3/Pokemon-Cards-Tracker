import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { ownedCardsCsv } from "@/lib/backup/csv";
import { exportFileName } from "@/lib/backup/profileData";
import { buildExport } from "@/lib/backup/profileDataService";

/** A backup of the signed-in person's collection, followed Pokémon, watched cards and alert rules, as a JSON download. */
export async function GET(request: Request) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  const now = new Date();
  const data = await buildExport(auth.profile, now);
  if (new URL(request.url).searchParams.get("format") === "csv") {
    return new NextResponse(ownedCardsCsv(data), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(auth.profile.name, now).replace(/\.json$/, "-cards.csv")}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(JSON.stringify(data, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(auth.profile.name, now)}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/current";
import { getImage } from "@/lib/images/store";
import { storableImageUrl } from "@/lib/images/rules";

/**
 * A saved copy of a set logo or icon: `/api/img?u=<its original address>`. Only addresses on the few
 * allowed image hosts are accepted; the first request fetches and saves the file, every later one is
 * served from the database.
 */
export async function GET(req: Request) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;

  const url = storableImageUrl(new URL(req.url).searchParams.get("u"));
  if (!url) return NextResponse.json({ error: "not an image this site keeps" }, { status: 400 });

  const image = await getImage(url);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(image.data as unknown as BodyInit, {
    headers: {
      "Content-Type": image.contentType,
      // The picture at an address never changes, so the browser can keep it for good.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

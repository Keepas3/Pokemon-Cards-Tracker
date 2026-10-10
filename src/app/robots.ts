import type { MetadataRoute } from "next";

/** A private site: ask every crawler to stay away. (The sign-in already keeps everything out of sight.) */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}

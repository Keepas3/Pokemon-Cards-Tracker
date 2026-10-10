import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app uses plain <img> tags for card art and logos, so Next's image optimizer
  // (/_next/image, a fetch-this-URL-for-me endpoint) isn't needed. Turning it off removes
  // that whole class of server-side-request-forgery problem rather than relying on patches.
  images: { unoptimized: true },

  // Removes the "X-Powered-By: Next.js" header.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nobody else's page may frame this one (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // A private site: keep it out of search results too.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // Retailer and TCGplayer links open without telling them which local address you came from.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

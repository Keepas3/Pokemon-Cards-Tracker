import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, sniffImageType, storableImageUrl, storedImageSrc } from "@/lib/images/rules";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

describe("storableImageUrl", () => {
  it("accepts images on the allowed hosts", () => {
    expect(storableImageUrl("https://assets.tcgdex.net/en/me/me04/logo.png")).toBe("https://assets.tcgdex.net/en/me/me04/logo.png");
    expect(storableImageUrl("https://tcgplayer-cdn.tcgplayer.com/set_icon/24655ME04ChaosRising.png")).not.toBeNull();
  });
  it("rejects other hosts, schemes, credentials, queries and non-images", () => {
    for (const bad of [
      "https://evil.example/logo.png",
      "https://assets.tcgdex.net.evil.example/logo.png",
      "http://assets.tcgdex.net/logo.png",
      "https://user:pw@assets.tcgdex.net/logo.png",
      "https://assets.tcgdex.net:8443/logo.png",
      "https://assets.tcgdex.net/logo.png?x=1",
      "https://assets.tcgdex.net/logo.svg",
      "https://assets.tcgdex.net/page.html",
      "javascript:alert(1)",
      "",
      null,
      42,
    ]) {
      expect(storableImageUrl(bad)).toBeNull();
    }
  });
});

describe("storedImageSrc", () => {
  it("points allowed images at our own copy and leaves anything else alone", () => {
    expect(storedImageSrc("https://assets.tcgdex.net/a/logo.png")).toBe(`/api/img?u=${encodeURIComponent("https://assets.tcgdex.net/a/logo.png")}`);
    expect(storedImageSrc("https://elsewhere.example/x.png")).toBe("https://elsewhere.example/x.png");
  });
});

describe("sniffImageType", () => {
  it("knows PNG, WebP and JPEG by their bytes", () => {
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
  });
  it("rejects HTML, SVG, empty and oversized data", () => {
    expect(sniffImageType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png);
    expect(sniffImageType(big)).toBeNull();
  });
});
